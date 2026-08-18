import { createHmac, randomUUID } from "node:crypto";

import { requireCloudContext } from "@/lib/cloud/auth";
import {
  cloudErrorResponse,
  cloudJson,
  CloudHttpError,
} from "@/lib/cloud/http";
import { getCloudProject } from "@/lib/cloud/repository";
import { isSameOriginRequest } from "@/lib/cloud/request-security";
import {
  councilSessionRequestSchema,
  type CouncilSessionRequest,
  type CouncilStageEvent,
} from "@/lib/council/contracts";
import { canUseCouncilRuntime } from "@/lib/council/agents";
import { executeLocalCouncilSession } from "@/lib/council/local-council";
import {
  CouncilCancelledError,
  executeCouncilSession,
} from "@/lib/council/runtime";
import { serializeCouncilInput } from "@/lib/council/prompt";
import { containsLikelySecret } from "@/lib/intelligence/prompt";
import { logOperationalEvent } from "@/lib/observability/structured-log";
import { buildProjectSnapshot } from "@/lib/workspace/project-snapshot-schema";
import {
  beginWorkspaceRequest,
  consumeWorkspaceCredits,
  finishWorkspaceRequest,
  workspaceUsageBackend,
} from "@/lib/workspace/usage-policy";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_REQUEST_BYTES = 90_000;

function usageSecret() {
  const secret = process.env.KINGXFORD_USAGE_HASH_SALT?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function accountUsageKey(userId: string, secret: string) {
  return `account:${createHmac("sha256", secret).update(userId).digest("hex").slice(0, 40)}`;
}

async function readBody(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_REQUEST_BYTES) {
    throw new CloudHttpError(
      413,
      "request_too_large",
      "The council request exceeds the accepted size.",
    );
  }
  return raw;
}

function providerCallBudget(input: CouncilSessionRequest) {
  return 2 + input.lenses.length * 2;
}

function screenForSecrets(input: CouncilSessionRequest) {
  const candidates = [
    input.objective,
    input.projectContext.objective,
    ...input.projectContext.evidence.flatMap((item) => [
      item.title,
      item.source,
      item.claim,
    ]),
    ...input.projectContext.decisions.flatMap((item) => [
      item.decision,
      item.rationale,
    ]),
    ...input.projectContext.artifacts.map((item) => item.summary),
  ];
  return candidates.some((value) => containsLikelySecret(value));
}

function eventLine(event: CouncilStageEvent) {
  return `${JSON.stringify(event)}\n`;
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    if (!isSameOriginRequest(request)) {
      throw new CloudHttpError(
        403,
        "origin_rejected",
        "A council session can be started only from the Kingxford site.",
      );
    }
    if (
      request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
      "application/json"
    ) {
      throw new CloudHttpError(
        415,
        "content_type_required",
        "A JSON council request is required.",
      );
    }

    const context = await requireCloudContext(request);
    if (context.role === "viewer") {
      throw new CloudHttpError(
        403,
        "council_start_denied",
        "A viewer can read a council session but cannot start one.",
      );
    }

    const rawBody = await readBody(request);
    let raw: unknown;
    try {
      raw = JSON.parse(rawBody) as unknown;
    } catch {
      throw new CloudHttpError(
        400,
        "invalid_json",
        "The council request could not be read.",
      );
    }
    const input = councilSessionRequestSchema.parse(raw);

    if (screenForSecrets(input)) {
      throw new CloudHttpError(
        422,
        "credential_detected",
        "The selected project material looks like it contains a credential. Remove it before starting a council session.",
      );
    }

    const cloudProject = await getCloudProject(
      context,
      input.projectContext.projectId,
    );
    if (!cloudProject) {
      throw new CloudHttpError(
        404,
        "cloud_project_not_found",
        "Save this Atlas project to the current organization before starting a council session.",
      );
    }

    const currentSnapshot = buildProjectSnapshot(cloudProject.project, {});
    if (currentSnapshot.hash !== input.projectGraphSnapshot.hash) {
      throw new CloudHttpError(
        409,
        "cloud_project_changed",
        "The cloud project changed after this snapshot was prepared. Synchronize the latest revision and start the session again.",
      );
    }

    const secret = usageSecret();
    const usageBackend = workspaceUsageBackend();
    if (!secret || !usageBackend.ready) {
      throw new CloudHttpError(
        503,
        "council_usage_not_configured",
        "Council usage protection is not configured on this deployment.",
      );
    }

    const usageKey = accountUsageKey(context.user.id, secret);
    const providerAvailable = canUseCouncilRuntime();
    const admission = await beginWorkspaceRequest(usageKey, requestId);
    if (!admission.allowed) {
      throw new CloudHttpError(
        admission.reason === "unavailable" ? 503 : 429,
        admission.reason === "unavailable"
          ? "usage_service_unavailable"
          : "rate_limited",
        admission.reason === "unavailable"
          ? "Council capacity is temporarily unavailable. No project content was sent to a model."
          : "The council start or concurrency limit has been reached. Try again after the stated interval.",
      );
    }

    // A session with no provider makes no provider call, so it reserves no
    // credits; it still holds the admission lease for concurrency control.
    const credits = providerAvailable
      ? await consumeWorkspaceCredits(
          admission.usageKey,
          input.depth,
          providerCallBudget(input),
          `${requestId}:credits`,
        )
      : ({ allowed: true } as const);
    if (!credits.allowed) {
      await finishWorkspaceRequest(admission.usageKey, admission.leaseId);
      throw new CloudHttpError(
        credits.reason === "unavailable" ? 503 : 429,
        credits.reason === "unavailable"
          ? "usage_service_unavailable"
          : credits.reason === "global"
            ? "deployment_limit_reached"
            : "daily_limit_reached",
        credits.reason === "unavailable"
          ? "Council usage accounting is temporarily unavailable. No project content was sent to a model."
          : credits.reason === "global"
            ? "This deployment has reached its daily provider allowance. The local reading remains available in Canvas."
            : "The daily council allowance has been reached. The local reading remains available in Canvas.",
      );
    }

    const encoder = new TextEncoder();
    const abortController = new AbortController();
    request.signal.addEventListener("abort", () => abortController.abort(), {
      once: true,
    });

    logOperationalEvent("info", "council.session.started", {
      requestId,
      phase: input.projectContext.phase,
      depth: input.depth,
      lenses: input.lenses.length,
      source: providerAvailable ? "gateway" : "local",
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: CouncilStageEvent) => {
          try {
            controller.enqueue(encoder.encode(eventLine(event)));
          } catch {
            // The client disconnected; the session still unwinds cleanly below.
          }
        };

        try {
          if (!providerAvailable) {
            const canonical = serializeCouncilInput(input);
            const local = executeLocalCouncilSession(input, {
              sessionId: `council_local_${requestId.replace(/-/g, "").slice(0, 24)}`,
              inputDigest: canonical.inputDigest,
            });
            emit({
              stage: "accepted",
              sessionId: local.sessionId,
              phase: local.phase,
              lenses: input.lenses,
              source: "local",
            });
            emit({ stage: "survey", survey: local.survey });
            for (const deliberation of local.deliberations) {
              emit({
                stage: "proposal",
                id: deliberation.id,
                lens: deliberation.lens,
                move: deliberation.move,
              });
              emit({
                stage: "challenge",
                id: deliberation.id,
                lens: deliberation.lens,
                challenge: deliberation.challenge,
                survivesChallenge: deliberation.survivesChallenge,
              });
            }
            emit({ stage: "complete", result: local });
          } else {
            await executeCouncilSession(input, {
              requestSignal: abortController.signal,
              safetyIdentifier: usageKey,
              sessionSeed: requestId,
              onStage: emit,
            });
          }
        } catch (error) {
          const cancelled = error instanceof CouncilCancelledError;
          emit({
            stage: "failed",
            code: cancelled ? "cancelled" : "council-failed",
            message: cancelled
              ? "The council session was cancelled. No project revision was applied and no phase gate changed."
              : "The council session could not be completed. No project revision was applied and no phase gate changed.",
          });
          logOperationalEvent(cancelled ? "info" : "warn", "council.session.failed", {
            requestId,
            cancelled,
          });
        } finally {
          await finishWorkspaceRequest(admission.usageKey, admission.leaseId);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
        "x-request-id": requestId,
        "x-accel-buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof CloudHttpError) {
      return cloudErrorResponse(error);
    }
    logOperationalEvent("error", "council.session.rejected", { requestId });
    return cloudJson(
      {
        ok: false,
        error: {
          code: "council_request_invalid",
          message: "The council request could not be processed.",
        },
        requestId,
      },
      { status: 400 },
    );
  }
}
