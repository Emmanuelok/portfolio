import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  canUseCreativeAgent,
  createCreativeAgent,
  CREATIVE_AGENT_MODEL,
  CREATIVE_AGENT_PROTOCOL_VERSION,
} from "@/lib/workspace/agent";
import { buildLocalReview } from "@/lib/workspace/local-analysis";
import { workspaceModes } from "@/lib/workspace/types";

export const maxDuration = 60;

const codeSchema = z.object({
  html: z.string().max(16000),
  css: z.string().max(16000),
  javascript: z.string().max(16000),
});

const requestSchema = z
  .object({
    mode: z.enum(workspaceModes),
    title: z.string().max(120),
    text: z.string().max(22000),
    code: codeSchema,
    objective: z.string().min(1).max(600),
    depth: z.enum(["standard", "deep"]),
    context: z.object({
      codeLogs: z.array(z.string().max(1000)).max(12),
      versions: z
        .array(
          z.object({
            name: z.string().max(120),
            mode: z.enum(workspaceModes),
            text: z.string().max(1800),
          }),
        )
        .max(3),
    }),
  })
  .superRefine((value, context) => {
    const total =
      value.text.length +
      value.code.html.length +
      value.code.css.length +
      value.code.javascript.length +
      value.objective.length +
      value.context.codeLogs.join("").length +
      value.context.versions.reduce((sum, version) => sum + version.text.length, 0);
    if (total > 40000) {
      context.addIssue({
        code: "custom",
        message: "Workspace context exceeds the 40,000-character review limit.",
      });
    }
  });

type RateBucket = { count: number; resetsAt: number };
const rateBuckets = new Map<string, RateBucket>();
const WINDOW_MS = 60_000;
const REQUESTS_PER_WINDOW = 6;

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
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(address).digest("hex").slice(0, 24);
}

function rateLimit(key: string) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetsAt <= now) {
    const next = { count: 1, resetsAt: now + WINDOW_MS };
    rateBuckets.set(key, next);
    return { allowed: true, remaining: REQUESTS_PER_WINDOW - 1, retryAfter: 0 };
  }
  current.count += 1;
  rateBuckets.set(key, current);
  return {
    allowed: current.count <= REQUESTS_PER_WINDOW,
    remaining: Math.max(0, REQUESTS_PER_WINDOW - current.count),
    retryAfter: Math.ceil((current.resetsAt - now) / 1000),
  };
}

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{24,}\b/,
  /\bgh[oprsu]_[A-Za-z0-9]{28,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[A-Z0-9]{16}\b/,
] as const;

function containsLikelySecret(value: string) {
  return secretPatterns.some((pattern) => pattern.test(value));
}

function reportAgentFailure(error: unknown) {
  const candidate = error && typeof error === "object"
    ? (error as {
        name?: unknown;
        message?: unknown;
        statusCode?: unknown;
        cause?: unknown;
      })
    : undefined;
  const cause = candidate?.cause && typeof candidate.cause === "object"
    ? (candidate.cause as {
        name?: unknown;
        message?: unknown;
        statusCode?: unknown;
      })
    : undefined;
  const compact = (value: unknown) =>
    typeof value === "string"
      ? value
          .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[redacted]")
          .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
          .slice(0, 600)
      : undefined;

  console.error("[workspace-agent] OpenAI review failed", {
    name: compact(candidate?.name),
    message: compact(candidate?.message),
    statusCode:
      typeof candidate?.statusCode === "number" ? candidate.statusCode : undefined,
    causeName: compact(cause?.name),
    causeMessage: compact(cause?.message),
    causeStatusCode:
      typeof cause?.statusCode === "number" ? cause.statusCode : undefined,
    model: CREATIVE_AGENT_MODEL,
  });
}

function serializeWorkspace(value: z.infer<typeof requestSchema>) {
  const code = value.mode === "code"
    ? `\nHTML\n${value.code.html}\n\nCSS\n${value.code.css}\n\nJAVASCRIPT\n${value.code.javascript}`
    : "";
  const logs = value.context.codeLogs.length
    ? `\n\nSELECTED PREVIEW CONSOLE\n${value.context.codeLogs.join("\n")}`
    : "";
  const versions = value.context.versions.length
    ? `\n\nSELECTED PRIOR VERSIONS\n${value.context.versions
        .map((version) => `${version.name} [${version.mode}]\n${version.text}`)
        .join("\n\n")}`
    : "";

  return `Review objective: ${value.objective}

<WORKSPACE_DATA>
Mode: ${value.mode}
Title: ${value.title || "Untitled"}
Current text:
${value.text}${code}${logs}${versions}
</WORKSPACE_DATA>

Produce an evidence-conscious review, a bounded next test, explicit proposed changes, an improved source version, and a practical build brief.`;
}

function localResponse(
  input: z.infer<typeof requestSchema>,
  notice: string,
) {
  return NextResponse.json(
    {
      review: buildLocalReview({
        mode: input.mode,
        title: input.title,
        text: input.text,
        code: input.code,
      }),
      source: "local",
      model: "local-readiness-rules-v1",
      protocolVersion: CREATIVE_AGENT_PROTOCOL_VERSION,
      notice,
    },
    { headers: responseHeaders() },
  );
}

export async function GET() {
  const configured = canUseCreativeAgent();
  return NextResponse.json(
    {
      available: configured,
      mode: configured ? "openai" : "local-fallback",
      model: CREATIVE_AGENT_MODEL.replace(/^openai\//, ""),
      protocolVersion: CREATIVE_AGENT_PROTOCOL_VERSION,
      dailyEvaluationEnabled: true,
      improvementPolicy: "versioned-evaluation-human-approval-rollback",
    },
    { headers: responseHeaders() },
  );
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { error: "This review endpoint accepts requests only from Kingxford Canvas." },
      { status: 403, headers: responseHeaders() },
    );
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json(
      { error: "A JSON workspace request is required." },
      { status: 415, headers: responseHeaders() },
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 90_000) {
    return NextResponse.json(
      { error: "The selected workspace context is too large for one review." },
      { status: 413, headers: responseHeaders() },
    );
  }

  const limit = rateLimit(clientKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Review limit reached. Keep working locally and try again shortly." },
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
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The workspace request could not be read." },
      { status: 400, headers: responseHeaders() },
    );
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "The workspace request is invalid." },
      { status: 400, headers: responseHeaders() },
    );
  }

  const serialized = serializeWorkspace(parsed.data);
  if (containsLikelySecret(serialized)) {
    return NextResponse.json(
      {
        error:
          "A likely credential or private key was detected. Remove it before asking for AI review.",
      },
      { status: 422, headers: responseHeaders() },
    );
  }

  if (!canUseCreativeAgent()) {
    return localResponse(
      parsed.data,
      "AI analysis is not configured in this environment. This is a local structural review, not model-generated feedback.",
    );
  }

  try {
    const agent = createCreativeAgent(parsed.data.depth);
    const result = await agent.generate({
      prompt: serialized,
      abortSignal: request.signal,
    });

    if (!result.output) {
      throw new Error("Structured review was empty.");
    }

    return NextResponse.json(
      {
        review: result.output,
        source: "openai",
        model: CREATIVE_AGENT_MODEL.replace(/^openai\//, ""),
        protocolVersion: CREATIVE_AGENT_PROTOCOL_VERSION,
      },
      {
        headers: responseHeaders({
          "X-RateLimit-Remaining": String(limit.remaining),
        }),
      },
    );
  } catch (error) {
    reportAgentFailure(error);
    return localResponse(
      parsed.data,
      "The OpenAI review was temporarily unavailable. Your input was not changed; this fallback uses local structural rules.",
    );
  }
}
