import { createHmac, randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  INTELLIGENCE_PROTOCOL_VERSION,
  intelligenceCapabilities,
  intelligenceRunRequestSchema,
  intelligenceRunResponseSchema,
  intelligenceSpecialistRoles,
  supportedIntelligenceCapabilities,
} from "@/lib/intelligence/contracts";
import {
  canUseIntelligenceRuntime,
  INTELLIGENCE_FALLBACK_MODEL,
  INTELLIGENCE_MODEL,
} from "@/lib/intelligence/agents";
import { PHASE_OPERATING_PLANS } from "@/lib/intelligence/policy";
import { containsLikelySecret } from "@/lib/intelligence/prompt";
import {
  executeIntelligenceRun,
  executeLocalIntelligenceRun,
  MAX_PROVIDER_CALLS,
} from "@/lib/intelligence/runtime";

export const maxDuration = 120;

const MAX_REQUEST_BYTES = 192_000;
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 4;
const MAX_RATE_BUCKETS = 1_024;

type RateBucket = Readonly<{ count: number; resetsAt: number }>;
const rateBuckets = new Map<string, RateBucket>();
const CLIENT_KEY_SECRET =
  process.env.KINGXFORD_CLIENT_HASH_SECRET ||
  process.env.AI_GATEWAY_API_KEY ||
  randomBytes(32).toString("hex");

class RequestBodyTooLargeError extends Error {}

function responseHeaders(extra?: HeadersInit) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");
  const isProduction = process.env.NODE_ENV === "production";

  if (!host) return false;
  if (!origin) return !isProduction;
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (isProduction && fetchSite !== "same-origin") return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "local";
  return createHmac("sha256", CLIENT_KEY_SECRET)
    .update(address)
    .digest("hex")
    .slice(0, 24);
}

function rateLimit(key: string) {
  const now = Date.now();
  for (const [bucketKey, bucket] of rateBuckets) {
    if (bucket.resetsAt <= now) rateBuckets.delete(bucketKey);
  }
  const current = rateBuckets.get(key);
  if (!current) {
    if (rateBuckets.size >= MAX_RATE_BUCKETS) {
      const oldestKey = rateBuckets.keys().next().value;
      if (typeof oldestKey === "string") rateBuckets.delete(oldestKey);
    }
    rateBuckets.set(key, { count: 1, resetsAt: now + WINDOW_MS });
    return { allowed: true, remaining: REQUESTS_PER_WINDOW - 1, retryAfter: 0 };
  }
  const next = { count: current.count + 1, resetsAt: current.resetsAt };
  rateBuckets.delete(key);
  rateBuckets.set(key, next);
  return {
    allowed: next.count <= REQUESTS_PER_WINDOW,
    remaining: Math.max(0, REQUESTS_PER_WINDOW - next.count),
    retryAfter: Math.max(1, Math.ceil((next.resetsAt - now) / 1_000)),
  };
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Missing request body.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    if (bytesRead > MAX_REQUEST_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new RequestBodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text) as unknown;
}

export async function GET() {
  const available = canUseIntelligenceRuntime();
  return NextResponse.json(
    {
      available,
      mode: available ? "openai" : "local-fallback",
      model: INTELLIGENCE_MODEL.replace(/^openai\//, ""),
      fallbackModel: INTELLIGENCE_FALLBACK_MODEL.replace(/^openai\//, ""),
      protocolVersion: INTELLIGENCE_PROTOCOL_VERSION,
      phases: Object.entries(PHASE_OPERATING_PLANS).map(([phase, plan]) => ({
        phase,
        objective: plan.objective,
        defaultSpecialists: plan.specialists,
        handoff: plan.handoff,
      })),
      specialistRoles: intelligenceSpecialistRoles,
      capabilities: {
        recognized: intelligenceCapabilities,
        supported: supportedIntelligenceCapabilities,
      },
      limits: {
        specialistPasses: 2,
        providerCalls: MAX_PROVIDER_CALLS,
        requestBytes: MAX_REQUEST_BYTES,
        requestsPerMinute: REQUESTS_PER_WINDOW,
      },
      improvementPolicy:
        "versioned-evaluation-human-approval-rollback-no-autonomous-deployment",
    },
    { headers: responseHeaders() },
  );
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: "This intelligence endpoint accepts same-origin Kingxford requests only." },
      { status: 403, headers: responseHeaders() },
    );
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json(
      { error: "A JSON project-intelligence request is required." },
      { status: 415, headers: responseHeaders() },
    );
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: "The selected project context is too large for one intelligence run." },
      { status: 413, headers: responseHeaders() },
    );
  }

  const requestIdentity = clientKey(request);
  const limit = rateLimit(requestIdentity);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Intelligence run limit reached. Keep working locally and retry shortly." },
      {
        status: 429,
        headers: responseHeaders({
          "Retry-After": String(limit.retryAfter),
          "X-RateLimit-Remaining": "0",
        }),
      },
    );
  }

  let raw: unknown;
  try {
    raw = await readJsonBody(request);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof RequestBodyTooLargeError
            ? "The selected project context is too large for one intelligence run."
            : "The project-intelligence request could not be read.",
      },
      {
        status: error instanceof RequestBodyTooLargeError ? 413 : 400,
        headers: responseHeaders(),
      },
    );
  }

  const parsed = intelligenceRunRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ||
          "The project-intelligence request is invalid.",
      },
      { status: 400, headers: responseHeaders() },
    );
  }
  const serializedRequest = JSON.stringify(parsed.data);
  if (containsLikelySecret(serializedRequest)) {
    return NextResponse.json(
      {
        error:
          "A likely credential or private key was detected. Remove it before starting an intelligence run.",
      },
      { status: 422, headers: responseHeaders() },
    );
  }

  try {
    const result = canUseIntelligenceRuntime()
      ? await executeIntelligenceRun(parsed.data, {
          requestSignal: request.signal,
          safetyIdentifier: requestIdentity,
        })
      : executeLocalIntelligenceRun(parsed.data);
    return NextResponse.json(intelligenceRunResponseSchema.parse(result), {
      headers: responseHeaders({
        "X-RateLimit-Remaining": String(limit.remaining),
      }),
    });
  } catch {
    console.error("[intelligence-runtime] run_failed", {
      code: "bounded-runtime-failure",
    });
    const fallback = executeLocalIntelligenceRun(parsed.data, {
      notice:
        "The governed runtime was temporarily unavailable. No project input was changed; this result uses deterministic local structural rules.",
    });
    return NextResponse.json(fallback, {
      headers: responseHeaders({
        "X-RateLimit-Remaining": String(limit.remaining),
      }),
    });
  }
}
