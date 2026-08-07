import { createHmac, randomUUID } from "node:crypto";

import { getRun, start } from "workflow/api";
import { z } from "zod";

import { requireCloudContext } from "@/lib/cloud/auth";
import {
  parseIdempotencyKey,
  requestFingerprint,
} from "@/lib/cloud/contracts";
import {
  cloudErrorResponse,
  cloudJson,
  CloudHttpError,
} from "@/lib/cloud/http";
import { getCloudProject } from "@/lib/cloud/repository";
import { createServiceCloudClient } from "@/lib/cloud/service";
import { canUseIntelligenceRuntime } from "@/lib/intelligence/agents";
import { intelligenceRunRequestSchema } from "@/lib/intelligence/contracts";
import { selectSpecialistRoles } from "@/lib/intelligence/policy";
import { containsLikelySecret } from "@/lib/intelligence/prompt";
import {
  MAX_PROVIDER_CALLS,
  validateIntelligenceProjectBinding,
} from "@/lib/intelligence/runtime";
import { logOperationalEvent } from "@/lib/observability/structured-log";
import { buildProjectSnapshot } from "@/lib/workspace/project-snapshot-schema";
import { workspaceUsageBackend } from "@/lib/workspace/usage-policy";
import {
  durableIntelligenceOutcomeSchema,
  runDurableIntelligenceReview,
  type DurableIntelligenceWorkflowInput,
} from "@/workflows/intelligence-review";

export const maxDuration = 30;

const MAX_REQUEST_BYTES = 90_000;
const runIdSchema = z
  .string()
  .min(8)
  .max(240)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

type StoredRun = Readonly<{
  id: string;
  workflowRunId: string | null;
  inputHash: string | null;
  status: string;
  userId: string | null;
}>;

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin === "null") return false;
  if (fetchSite && fetchSite !== "same-origin") return false;

  const requestUrl = new URL(request.url);
  const host =
    firstForwardedValue(request.headers.get("x-forwarded-host")) ||
    firstForwardedValue(request.headers.get("host")) ||
    requestUrl.host;
  const protocol =
    firstForwardedValue(request.headers.get("x-forwarded-proto")) ||
    requestUrl.protocol.replace(":", "");
  try {
    const candidate = new URL(origin);
    return candidate.host === host && candidate.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}

function parseStoredRun(value: unknown): StoredRun | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    (row.workflow_run_id !== null &&
      typeof row.workflow_run_id !== "string") ||
    (row.input_hash !== null && typeof row.input_hash !== "string") ||
    typeof row.status !== "string" ||
    (row.user_id !== null && typeof row.user_id !== "string")
  ) {
    return null;
  }
  return {
    id: row.id,
    workflowRunId: row.workflow_run_id,
    inputHash: row.input_hash,
    status: row.status,
    userId: row.user_id,
  };
}

function usageSecret() {
  const value = process.env.KINGXFORD_USAGE_HASH_SALT?.trim();
  return value && value.length >= 32 ? value : null;
}

function authenticatedUsageKey(userId: string, secret: string) {
  return createHmac("sha256", secret)
    .update("cloud-user\0")
    .update(userId)
    .digest("hex");
}

function providerCallBudget(
  input: z.infer<typeof intelligenceRunRequestSchema>,
) {
  const roles = selectSpecialistRoles(
    input.projectContext.phase,
    input.orchestration.requestedRoles,
    input.orchestration.maxSpecialistPasses,
  );
  return Math.min(MAX_PROVIDER_CALLS, 2 + roles.length);
}

async function readBody(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) {
    throw new CloudHttpError(
      413,
      "request_too_large",
      "The selected project context is too large for one durable review.",
    );
  }
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BYTES) {
    throw new CloudHttpError(
      413,
      "request_too_large",
      "The selected project context is too large for one durable review.",
    );
  }
  if (containsLikelySecret(body)) {
    throw new CloudHttpError(
      422,
      "likely_secret",
      "A likely credential or private key was detected. Remove it before starting the review.",
    );
  }
  return body;
}

async function findStoredRun(
  context: Awaited<ReturnType<typeof requireCloudContext>>,
  field: "request_id" | "workflow_run_id",
  value: string,
) {
  const { data, error } = await context.client
    .from("intelligence_runs")
    .select("id, workflow_run_id, input_hash, status, user_id")
    .eq("organization_id", context.organizationId)
    .eq(field, value)
    .maybeSingle();
  if (error) {
    throw new CloudHttpError(
      503,
      "run_registry_unavailable",
      "The durable review registry is temporarily unavailable.",
    );
  }
  return parseStoredRun(data);
}

function acceptedResponse(
  workflowRunId: string,
  requestId: string,
  replayed: boolean,
) {
  return cloudJson(
    {
      accepted: true,
      replayed,
      requestId,
      runId: workflowRunId,
      status: "queued",
      statusUrl: `/api/intelligence/workflows?runId=${encodeURIComponent(workflowRunId)}`,
    },
    {
      status: replayed ? 200 : 202,
      headers: { "X-Kingxford-Request-Id": requestId },
    },
  );
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    if (!sameOrigin(request)) {
      throw new CloudHttpError(
        403,
        "origin_rejected",
        "Durable project reviews can be started only from the Kingxford site.",
      );
    }
    if (
      request.headers.get("content-type")?.split(";", 1)[0]?.trim() !==
      "application/json"
    ) {
      throw new CloudHttpError(
        415,
        "content_type_required",
        "A JSON durable review request is required.",
      );
    }

    const context = await requireCloudContext(request);
    if (context.role === "viewer") {
      throw new CloudHttpError(
        403,
        "review_start_denied",
        "A viewer can inspect project history but cannot start a durable review.",
      );
    }
    let idempotencyKey: string;
    try {
      idempotencyKey = parseIdempotencyKey(
        request.headers.get("idempotency-key"),
      );
    } catch (error) {
      throw new CloudHttpError(
        400,
        "invalid_idempotency_key",
        error instanceof Error
          ? error.message
          : "A valid Idempotency-Key is required.",
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
        "The durable review request could not be read.",
      );
    }
    const input = intelligenceRunRequestSchema.parse(raw);
    try {
      validateIntelligenceProjectBinding(input);
    } catch {
      throw new CloudHttpError(
        422,
        "project_binding_invalid",
        "The Atlas snapshot, active revision, and submitted draft do not form a valid review binding.",
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
        "Save this Atlas project to the current organization before starting a durable review.",
      );
    }
    const requestedArtifact = input.projectGraphSnapshot.artifacts.find(
      ({ activeRevision }) =>
        activeRevision.id === input.artifactRevisionId,
    );
    const currentSnapshot = buildProjectSnapshot(cloudProject.project, {
      activeArtifactId: requestedArtifact?.id,
    });
    if (
      currentSnapshot.id !== input.projectGraphSnapshot.id ||
      currentSnapshot.hash !== input.projectGraphSnapshot.hash
    ) {
      throw new CloudHttpError(
        409,
        "cloud_project_changed",
        "The cloud project changed after this snapshot was prepared. Synchronize the latest revision and review it again.",
      );
    }

    const secret = usageSecret();
    const usageBackend = workspaceUsageBackend();
    if (!secret || !usageBackend.durable) {
      throw new CloudHttpError(
        503,
        "durable_usage_not_configured",
        "Durable review usage protection is not configured on this deployment.",
      );
    }
    if (!canUseIntelligenceRuntime()) {
      throw new CloudHttpError(
        503,
        "ai_provider_not_configured",
        "AI-assisted durable review is not configured. Local project analysis remains available in Canvas.",
      );
    }
    const serviceClient = createServiceCloudClient();
    if (!serviceClient) {
      throw new CloudHttpError(
        503,
        "workflow_persistence_not_configured",
        "Secure workflow persistence is not configured on this deployment.",
      );
    }

    const inputHash = requestFingerprint(input);
    const existing = await findStoredRun(
      context,
      "request_id",
      idempotencyKey,
    );
    if (existing) {
      if (existing.inputHash !== inputHash) {
        throw new CloudHttpError(
          409,
          "idempotency_conflict",
          "This Idempotency-Key was already used for a different review request.",
        );
      }
      if (existing.workflowRunId) {
        return acceptedResponse(
          existing.workflowRunId,
          requestId,
          true,
        );
      }
    }

    let databaseRunId = existing?.id;
    if (!databaseRunId) {
      const { data, error } = await serviceClient
        .from("intelligence_runs")
        .insert({
          organization_id: context.organizationId,
          project_id: input.projectContext.projectId,
          user_id: context.user.id,
          request_id: idempotencyKey,
          mode: "durable-intelligence-review",
          status: "queued",
          input_hash: inputHash,
        })
        .select("id")
        .single();
      if (error || !data || typeof data.id !== "string") {
        const raced = await findStoredRun(
          context,
          "request_id",
          idempotencyKey,
        );
        if (!raced || raced.inputHash !== inputHash) {
          throw new CloudHttpError(
            503,
            "run_registry_write_failed",
            "The durable review could not be registered.",
          );
        }
        if (raced.workflowRunId) {
          return acceptedResponse(raced.workflowRunId, requestId, true);
        }
        databaseRunId = raced.id;
      } else {
        databaseRunId = data.id;
      }
    }

    const workflowInput: DurableIntelligenceWorkflowInput = {
      databaseRunId,
      organizationId: context.organizationId,
      requestId,
      request: input,
      safetyIdentifier: authenticatedUsageKey(context.user.id, secret),
      usageKey: authenticatedUsageKey(context.user.id, secret),
      reservedProviderCalls: providerCallBudget(input),
    };
    const run = await start(runDurableIntelligenceReview, [workflowInput]);
    const { error: attachmentError } = await serviceClient
      .from("intelligence_runs")
      .update({ workflow_run_id: run.runId })
      .eq("id", databaseRunId)
      .eq("organization_id", context.organizationId);
    if (attachmentError) {
      logOperationalEvent("warn", "intelligence.workflow.registry_attach_delayed", {
        requestId,
        workflowRunId: run.runId,
        databaseRunId,
      });
    }

    logOperationalEvent("info", "intelligence.workflow.queued", {
      requestId,
      workflowRunId: run.runId,
      databaseRunId,
      phase: input.projectContext.phase,
      depth: input.depth,
      reservedProviderCalls: workflowInput.reservedProviderCalls,
    });
    return acceptedResponse(run.runId, requestId, false);
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const context = await requireCloudContext(request);
    const runId = runIdSchema.parse(new URL(request.url).searchParams.get("runId"));
    const stored = await findStoredRun(
      context,
      "workflow_run_id",
      runId,
    );
    if (!stored) {
      throw new CloudHttpError(
        404,
        "review_run_not_found",
        "The requested durable review was not found in this organization.",
      );
    }

    const run = getRun(runId);
    if (!(await run.exists)) {
      throw new CloudHttpError(
        404,
        "workflow_run_not_found",
        "The durable workflow record is not available.",
      );
    }
    const status = await run.status;
    if (status === "completed") {
      const outcome = durableIntelligenceOutcomeSchema.parse(
        await run.returnValue,
      );
      return cloudJson({ runId, status, outcome });
    }
    return cloudJson({ runId, status });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) {
      throw new CloudHttpError(
        403,
        "origin_rejected",
        "Durable project reviews can be cancelled only from the Kingxford site.",
      );
    }
    const context = await requireCloudContext(request);
    const runId = runIdSchema.parse(new URL(request.url).searchParams.get("runId"));
    const stored = await findStoredRun(
      context,
      "workflow_run_id",
      runId,
    );
    if (!stored) {
      throw new CloudHttpError(
        404,
        "review_run_not_found",
        "The requested durable review was not found in this organization.",
      );
    }
    const canCancel =
      stored.userId === context.user.id ||
      context.role === "owner" ||
      context.role === "admin";
    if (!canCancel) {
      throw new CloudHttpError(
        403,
        "review_cancel_denied",
        "Only the person who started this review or an organization administrator can cancel it.",
      );
    }

    const serviceClient = createServiceCloudClient();
    if (!serviceClient) {
      throw new CloudHttpError(
        503,
        "workflow_persistence_not_configured",
        "Secure workflow persistence is not configured on this deployment.",
      );
    }

    const run = getRun(runId);
    if (await run.exists) await run.cancel();
    const { error: cancellationError } = await serviceClient
      .from("intelligence_runs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", stored.id)
      .eq("organization_id", context.organizationId);
    if (cancellationError) {
      throw new CloudHttpError(
        503,
        "run_registry_write_failed",
        "The workflow was cancelled, but its registry status could not be updated.",
      );
    }
    return cloudJson({ runId, status: "cancelled" });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
