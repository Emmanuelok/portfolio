import { createHash, createHmac, randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  canUseIntelligenceRuntime,
  getIntelligenceModelRoute,
} from "@/lib/intelligence/agents";
import {
  INTELLIGENCE_PROTOCOL_VERSION,
  intelligenceCapabilities,
  intelligenceRunRequestSchema,
  intelligenceRunResponseSchema,
  intelligenceSpecialistRoles,
  supportedIntelligenceCapabilities,
} from "@/lib/intelligence/contracts";
import {
  PHASE_OPERATING_PLANS,
  selectSpecialistRoles,
} from "@/lib/intelligence/policy";
import { containsLikelySecret } from "@/lib/intelligence/prompt";
import {
  executeIntelligenceRun,
  executeLocalIntelligenceRun,
  IntelligenceProjectBindingError,
  IntelligenceRunCancelledError,
  MAX_PROVIDER_CALLS,
  validateIntelligenceProjectBinding,
} from "@/lib/intelligence/runtime";
import {
  PROJECT_SNAPSHOT_BOUNDS,
  PROJECT_SNAPSHOT_SCHEMA_VERSION,
} from "@/lib/workspace/project-snapshot-schema";
import {
  beginWorkspaceRequest,
  consumeWorkspaceCredits,
  finishWorkspaceRequest,
  getWorkspaceUsage,
  workspaceUsagePolicy,
  type WorkspaceUsageSnapshot,
} from "@/lib/workspace/usage-policy";

export const maxDuration = 120;

const MAX_REQUEST_BYTES = 90_000;
const REQUIRED_USAGE_SALT_CHARACTERS = 32;

class RequestBodyTooLargeError extends Error {}

function responseHeaders(
  requestId: string,
  extra: Readonly<Record<string, string>> = {},
) {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Kingxford-Request-Id": requestId,
    ...extra,
  };
}

function usageHeaders(usage: WorkspaceUsageSnapshot) {
  return {
    "X-RateLimit-Remaining": String(usage.minuteRemaining),
    "X-Kingxford-Daily-Credits-Remaining": String(
      usage.dailyCreditsRemaining,
    ),
    "X-Kingxford-Credit-Cost": String(usage.creditCost),
  };
}

function errorResponse(
  message: string,
  status: number,
  requestId: string,
  options?: Readonly<{
    headers?: Readonly<Record<string, string>>;
    limits?: WorkspaceUsageSnapshot;
  }>,
) {
  return NextResponse.json(
    {
      error: message,
      requestId,
      ...(options?.limits ? { limits: options.limits } : {}),
    },
    {
      status,
      headers: responseHeaders(requestId, options?.headers),
    },
  );
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    firstForwardedValue(request.headers.get("host"));
  const fetchSite = request.headers.get("sec-fetch-site");
  const isProduction = process.env.NODE_ENV === "production";

  if (!origin || !host) return !isProduction;
  if (fetchSite && fetchSite !== "same-origin") return false;
  if (isProduction && fetchSite !== "same-origin") return false;

  const expectedProtocol =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ||
    request.nextUrl.protocol.replace(":", "");

  try {
    const candidate = new URL(origin);
    return (
      candidate.host.toLocaleLowerCase("en") ===
        host.toLocaleLowerCase("en") &&
      candidate.protocol === `${expectedProtocol}:`
    );
  } catch {
    return false;
  }
}

function usageHashSecret() {
  const configured = process.env.KINGXFORD_USAGE_HASH_SALT?.trim();
  if (configured && configured.length >= REQUIRED_USAGE_SALT_CHARACTERS) {
    return configured;
  }
  if (process.env.NODE_ENV === "production") return undefined;

  return (
    process.env.VERCEL_PROJECT_ID?.trim() ||
    "kingxford-local-usage-hmac-development-only"
  );
}

function clientKey(request: NextRequest, salt: string) {
  const address = (
    firstForwardedValue(request.headers.get("x-forwarded-for")) ||
    request.headers.get("x-real-ip") ||
    "local"
  ).slice(0, 256);
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(
    0,
    256,
  );
  const requestFingerprint = createHash("sha256")
    .update(address)
    .update("\0")
    .update(userAgent)
    .digest("hex");

  // This is the server-owned pseudonym. agents.ts hashes it again before the
  // identifier reaches AI Gateway, so neither IP nor user agent is disclosed.
  return createHmac("sha256", salt)
    .update(requestFingerprint)
    .digest("hex");
}

async function readRequestBody(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) return "";

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
  return text;
}

function providerCallBudget(
  request: ReturnType<typeof intelligenceRunRequestSchema.parse>,
) {
  const roles = selectSpecialistRoles(
    request.projectContext.phase,
    request.orchestration.requestedRoles,
    request.orchestration.maxSpecialistPasses,
  );
  return Math.min(MAX_PROVIDER_CALLS, 2 + roles.length);
}

function boundedProjectError(error: unknown) {
  if (error instanceof IntelligenceProjectBindingError) return error.message;
  return "The project graph snapshot failed integrity validation.";
}

function reportRuntimeFailure(error: unknown, requestId: string) {
  const candidate =
    error && typeof error === "object"
      ? (error as { name?: unknown; statusCode?: unknown })
      : undefined;
  console.error("[intelligence-runtime] run_failed", {
    requestId,
    name:
      typeof candidate?.name === "string"
        ? candidate.name.slice(0, 120)
        : "unknown",
    statusCode:
      typeof candidate?.statusCode === "number"
        ? candidate.statusCode
        : undefined,
  });
}

export async function GET() {
  const requestId = randomUUID();
  const gatewayConfigured = canUseIntelligenceRuntime();
  const usageProtectionConfigured = Boolean(usageHashSecret());
  const available = gatewayConfigured && usageProtectionConfigured;
  const standard = getIntelligenceModelRoute("standard");
  const deep = getIntelligenceModelRoute("deep");

  return NextResponse.json(
    {
      available,
      mode: !usageProtectionConfigured
        ? "unavailable"
        : gatewayConfigured
          ? "openai"
          : "local-fallback",
      gateway: gatewayConfigured,
      usageProtectionConfigured,
      model: deep.model.replace(/^openai\//, ""),
      routing: { standard, deep },
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
      projectContext: {
        required: true,
        schemaVersion: PROJECT_SNAPSHOT_SCHEMA_VERSION,
        bounds: PROJECT_SNAPSHOT_BOUNDS,
        integrityRequired: true,
        activeRevisionRequired: true,
        fullDraftHashRequired: true,
      },
      limits: {
        ...workspaceUsagePolicy,
        specialistPasses: 2,
        providerCalls: MAX_PROVIDER_CALLS,
        requestBytes: MAX_REQUEST_BYTES,
        creditAccounting: "per-reserved-provider-call",
      },
      improvementPolicy:
        "versioned-evaluation-human-approval-rollback-no-autonomous-deployment",
      toolsEnabled: false,
      automaticApplyEnabled: false,
      gateApprovalMode: "human-only",
    },
    { headers: responseHeaders(requestId) },
  );
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();

  if (!sameOrigin(request)) {
    return errorResponse(
      "This intelligence endpoint accepts same-origin Kingxford requests only.",
      403,
      requestId,
    );
  }

  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLocaleLowerCase("en");
  if (mediaType !== "application/json") {
    return errorResponse(
      "A JSON project-intelligence request is required.",
      415,
      requestId,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return errorResponse(
      "The selected project context is too large for one intelligence run.",
      413,
      requestId,
    );
  }

  const usageSecret = usageHashSecret();
  if (!usageSecret) {
    return errorResponse(
      "AI usage protection is not configured for this deployment.",
      503,
      requestId,
    );
  }

  const visitorKey = clientKey(request, usageSecret);
  let usageKey = visitorKey;
  const admission = beginWorkspaceRequest(usageKey);
  if (!admission.allowed) {
    const message =
      admission.reason === "concurrency"
        ? "Two intelligence runs are already active for this visitor. Let one finish before starting another."
        : "Intelligence run limit reached. Keep working locally and retry shortly.";
    return errorResponse(message, 429, requestId, {
      headers: {
        "Retry-After": String(admission.retryAfter),
        "X-RateLimit-Remaining": "0",
      },
      limits: admission.usage,
    });
  }

  usageKey = admission.usageKey;
  try {
    let rawBody: string;
    try {
      rawBody = await readRequestBody(request);
    } catch (error) {
      return errorResponse(
        error instanceof RequestBodyTooLargeError
          ? "The selected project context is too large for one intelligence run."
          : "The project-intelligence request could not be read.",
        error instanceof RequestBodyTooLargeError ? 413 : 400,
        requestId,
        { limits: admission.usage },
      );
    }

    if (containsLikelySecret(rawBody)) {
      return errorResponse(
        "A likely credential or private key was detected. Remove it before starting an intelligence run.",
        422,
        requestId,
        { limits: admission.usage },
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(rawBody) as unknown;
    } catch {
      return errorResponse(
        "The project-intelligence request could not be read.",
        400,
        requestId,
        { limits: admission.usage },
      );
    }

    const parsed = intelligenceRunRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message ||
          "The project-intelligence request is invalid.",
        400,
        requestId,
        { limits: admission.usage },
      );
    }

    const input = parsed.data;
    const reservedCalls = providerCallBudget(input);
    let binding: ReturnType<typeof validateIntelligenceProjectBinding>;
    try {
      binding = validateIntelligenceProjectBinding(input);
    } catch (error) {
      return errorResponse(boundedProjectError(error), 422, requestId, {
        limits: getWorkspaceUsage(usageKey, input.depth, reservedCalls),
      });
    }

    // Keep the validation result live until dispatch so future refactors cannot
    // accidentally make provider execution independent from Atlas integrity.
    if (binding.artifactRevisionId !== input.artifactRevisionId) {
      return errorResponse(
        "The active artifact revision changed before this run could begin.",
        409,
        requestId,
        { limits: getWorkspaceUsage(usageKey, input.depth, reservedCalls) },
      );
    }

    if (!canUseIntelligenceRuntime()) {
      const usage = {
        ...getWorkspaceUsage(usageKey, input.depth, reservedCalls),
        creditCost: 0,
      };
      const result = executeLocalIntelligenceRun(input, { runId: requestId });
      return NextResponse.json(intelligenceRunResponseSchema.parse(result), {
        headers: responseHeaders(requestId, usageHeaders(usage)),
      });
    }

    const credits = consumeWorkspaceCredits(
      usageKey,
      input.depth,
      reservedCalls,
    );
    if (!credits.allowed) {
      return errorResponse(
        "The anonymous AI intelligence allowance has been used for today. Local Kingxford work remains available.",
        429,
        requestId,
        {
          headers: {
            "Retry-After": String(credits.retryAfter),
            ...usageHeaders(credits.usage),
          },
          limits: credits.usage,
        },
      );
    }

    try {
      const result = await executeIntelligenceRun(input, {
        requestSignal: request.signal,
        safetyIdentifier: visitorKey,
        runId: requestId,
      });
      return NextResponse.json(intelligenceRunResponseSchema.parse(result), {
        headers: responseHeaders(requestId, usageHeaders(credits.usage)),
      });
    } catch (error) {
      if (
        error instanceof IntelligenceRunCancelledError ||
        request.signal.aborted
      ) {
        return errorResponse(
          "The intelligence run was cancelled before it completed.",
          499,
          requestId,
          { limits: credits.usage },
        );
      }

      reportRuntimeFailure(error, requestId);
      const fallback = executeLocalIntelligenceRun(input, {
        runId: requestId,
        notice:
          "The governed runtime was temporarily unavailable. No project input was changed; this result uses deterministic local structural rules.",
      });
      return NextResponse.json(fallback, {
        headers: responseHeaders(requestId, usageHeaders(credits.usage)),
      });
    }
  } finally {
    finishWorkspaceRequest(usageKey);
  }
}
