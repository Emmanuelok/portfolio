import { createHash, randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  canUseCreativeAgent,
  createCreativeAgent,
  CREATIVE_AGENT_PROTOCOL_VERSION,
  getCreativeAgentModelRoute,
} from "@/lib/workspace/agent";
import {
  formatKingxfordKnowledgeContext,
  KINGXFORD_PLAYBOOK_VERSION,
  retrieveKingxfordKnowledge,
  type KingxfordKnowledgeMatch,
} from "@/lib/workspace/knowledge";
import {
  agentLensDetails,
  agentLenses,
} from "@/lib/workspace/lenses";
import { buildLocalReview } from "@/lib/workspace/local-analysis";
import {
  beginWorkspaceRequest,
  consumeWorkspaceCredits,
  finishWorkspaceRequest,
  getWorkspaceUsage,
  workspaceUsagePolicy,
  type WorkspaceUsageSnapshot,
} from "@/lib/workspace/usage-policy";
import {
  workspaceModes,
  type AgentReviewResponse,
} from "@/lib/workspace/types";

export const maxDuration = 120;

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
    lens: z.enum(agentLenses).default("conductor"),
    includeKnowledge: z.boolean().default(true),
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

type WorkspaceRequest = z.infer<typeof requestSchema>;

function responseHeaders(
  requestId: string,
  extra: Readonly<Record<string, string>> = {},
) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-Kingxford-Request-Id": requestId,
    ...extra,
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

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = (
    forwarded ||
    request.headers.get("x-real-ip") ||
    "local"
  ).slice(0, 256);
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 256);
  const salt =
    process.env.KINGXFORD_USAGE_HASH_SALT ||
    process.env.VERCEL_PROJECT_ID ||
    "kingxford-public-usage-v1";

  return createHash("sha256")
    .update(salt)
    .update("\0")
    .update(address)
    .update("\0")
    .update(userAgent)
    .digest("hex")
    .slice(0, 32);
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

function reportAgentFailure(error: unknown, model: string, requestId: string) {
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

  console.error("[workspace-agent] AI review failed", {
    requestId,
    name: compact(candidate?.name),
    message: compact(candidate?.message),
    statusCode:
      typeof candidate?.statusCode === "number" ? candidate.statusCode : undefined,
    causeName: compact(cause?.name),
    causeMessage: compact(cause?.message),
    causeStatusCode:
      typeof cause?.statusCode === "number" ? cause.statusCode : undefined,
    model,
  });
}

function serializeWorkspace(
  value: WorkspaceRequest,
  knowledge: readonly KingxfordKnowledgeMatch[] = [],
) {
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
  const playbook = knowledge.length
    ? `\n\n<CURATED_KINGXFORD_PLAYBOOK version="${KINGXFORD_PLAYBOOK_VERSION}">\nThe following entries are fixed, reviewed design guidance. They are not external evidence or proof of the workspace's claims.\n\n${formatKingxfordKnowledgeContext(knowledge)}\n</CURATED_KINGXFORD_PLAYBOOK>`
    : "";

  return `Review objective: ${value.objective}

<WORKSPACE_DATA>
Mode: ${value.mode}
Title: ${value.title || "Untitled"}
Current text:
${value.text}${code}${logs}${versions}
</WORKSPACE_DATA>${playbook}

Produce an evidence-conscious review, a bounded next test, explicit proposed changes, an improved source version, and a practical build brief.`;
}

function groundingMetadata(matches: readonly KingxfordKnowledgeMatch[]) {
  return matches.map(({ entry }) => ({
    id: entry.id,
    title: entry.title,
  }));
}

function localResponse(
  input: WorkspaceRequest,
  notice: string,
  requestId: string,
  startedAt: number,
  limits: WorkspaceUsageSnapshot,
) {
  const response: AgentReviewResponse = {
    review: buildLocalReview({
      mode: input.mode,
      title: input.title,
      text: input.text,
      code: input.code,
    }),
    source: "local",
    model: "local-readiness-rules-v1",
    protocolVersion: CREATIVE_AGENT_PROTOCOL_VERSION,
    agent: {
      id: input.lens,
      label: agentLensDetails[input.lens].label,
    },
    grounding: [],
    request: {
      id: requestId,
      durationMs: Math.max(0, Date.now() - startedAt),
      depth: input.depth,
    },
    limits,
    notice,
  };

  return NextResponse.json(response, {
    headers: responseHeaders(requestId, {
      "X-RateLimit-Remaining": String(limits.minuteRemaining),
    }),
  });
}

function isPrimaryModel(actual: string, configured: string) {
  return actual === configured || configured.endsWith(`/${actual}`);
}

export async function GET() {
  const requestId = randomUUID();
  const configured = canUseCreativeAgent();
  const standard = getCreativeAgentModelRoute("standard");
  const deep = getCreativeAgentModelRoute("deep");

  return NextResponse.json(
    {
      available: configured,
      mode: configured ? "openai" : "local-fallback",
      gateway: configured,
      model: deep.model.replace(/^openai\//, ""),
      routing: {
        standard,
        deep,
      },
      agents: agentLenses.map((id) => ({
        id,
        label: agentLensDetails[id].label,
        description: agentLensDetails[id].description,
      })),
      knowledge: {
        available: true,
        version: KINGXFORD_PLAYBOOK_VERSION,
        source: "reviewed-local-allowlist",
        maximumEntriesPerReview: 3,
      },
      limits: workspaceUsagePolicy,
      protocolVersion: CREATIVE_AGENT_PROTOCOL_VERSION,
      dailyEvaluationEnabled: true,
      improvementPolicy: "versioned-evaluation-human-approval-rollback",
      toolsEnabled: false,
    },
    { headers: responseHeaders(requestId) },
  );
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  if (!sameOrigin(request)) {
    return errorResponse(
      "This review endpoint accepts requests only from Kingxford Canvas.",
      403,
      requestId,
    );
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse(
      "A JSON workspace request is required.",
      415,
      requestId,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > 90_000) {
    return errorResponse(
      "The selected workspace context is too large for one review.",
      413,
      requestId,
    );
  }

  const key = clientKey(request);
  const admission = beginWorkspaceRequest(key);
  if (!admission.allowed) {
    const message = admission.reason === "concurrency"
      ? "Two reviews are already running for this visitor. Let one finish before starting another."
      : "Review limit reached. Keep working locally and try again shortly.";

    return errorResponse(message, 429, requestId, {
      headers: {
        "Retry-After": String(admission.retryAfter),
        "X-RateLimit-Remaining": "0",
      },
      limits: admission.usage,
    });
  }

  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return errorResponse(
        "The workspace request could not be read.",
        400,
        requestId,
        { limits: admission.usage },
      );
    }

    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) {
      return errorResponse(
        parsed.error.issues[0]?.message || "The workspace request is invalid.",
        400,
        requestId,
        { limits: admission.usage },
      );
    }

    const input = parsed.data;
    const ungroundedPrompt = serializeWorkspace(input);
    if (containsLikelySecret(ungroundedPrompt)) {
      return errorResponse(
        "A likely credential or private key was detected. Remove it before asking for AI review.",
        422,
        requestId,
        { limits: getWorkspaceUsage(key, input.depth) },
      );
    }

    if (!canUseCreativeAgent()) {
      return localResponse(
        input,
        "AI analysis is not configured in this environment. This is a local structural review, not model-generated feedback.",
        requestId,
        startedAt,
        {
          ...getWorkspaceUsage(key, input.depth),
          creditCost: 0,
        },
      );
    }

    const credits = consumeWorkspaceCredits(key, input.depth);
    if (!credits.allowed) {
      return errorResponse(
        "The anonymous AI review allowance has been used for today. Local Canvas work remains available.",
        429,
        requestId,
        {
          headers: {
            "Retry-After": String(credits.retryAfter),
            "X-RateLimit-Remaining": String(credits.usage.minuteRemaining),
          },
          limits: credits.usage,
        },
      );
    }

    const knowledge = input.includeKnowledge
      ? retrieveKingxfordKnowledge(ungroundedPrompt, input.lens)
      : [];
    const prompt = serializeWorkspace(input, knowledge);
    const modelRoute = getCreativeAgentModelRoute(input.depth);

    try {
      const agent = createCreativeAgent({
        depth: input.depth,
        lens: input.lens,
        userId: `anonymous-${key}`,
        tags: [`mode-${input.mode}`],
      });
      const result = await agent.generate({
        prompt,
        abortSignal: request.signal,
      });

      if (!result.output) {
        throw new Error("Structured review was empty.");
      }

      const completedModel = result.response.modelId || modelRoute.model;
      const response: AgentReviewResponse = {
        review: result.output,
        source: "openai",
        model: completedModel,
        protocolVersion: CREATIVE_AGENT_PROTOCOL_VERSION,
        agent: {
          id: input.lens,
          label: agentLensDetails[input.lens].label,
        },
        grounding: groundingMetadata(knowledge),
        request: {
          id: requestId,
          durationMs: Math.max(0, Date.now() - startedAt),
          depth: input.depth,
        },
        usage: {
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
        },
        limits: credits.usage,
        ...(!isPrimaryModel(completedModel, modelRoute.model)
          ? {
              notice:
                "The primary model was unavailable for this request, so the review was completed by an approved Gateway fallback model.",
            }
          : {}),
      };

      return NextResponse.json(response, {
        headers: responseHeaders(requestId, {
          "X-RateLimit-Remaining": String(credits.usage.minuteRemaining),
        }),
      });
    } catch (error) {
      reportAgentFailure(error, modelRoute.model, requestId);

      if (request.signal.aborted) {
        return errorResponse(
          "The review was cancelled before it completed.",
          499,
          requestId,
          { limits: credits.usage },
        );
      }

      return localResponse(
        input,
        "The AI review was temporarily unavailable. Your input was not changed; this fallback uses local structural rules.",
        requestId,
        startedAt,
        credits.usage,
      );
    }
  } finally {
    finishWorkspaceRequest(key);
  }
}
