import {
  createHook,
  getStepMetadata,
  getWorkflowMetadata,
} from "workflow";
import { getRun } from "workflow/api";
import { z } from "zod";

import { createServiceCloudClient } from "@/lib/cloud/service";
import {
  intelligenceRunRequestSchema,
  intelligenceRunResponseSchema,
  type IntelligenceRunRequest,
} from "@/lib/intelligence/contracts";
import { logOperationalEvent } from "@/lib/observability/structured-log";
import {
  executeIntelligenceRun,
  INTELLIGENCE_RUN_TIMEOUT_MS,
  validateIntelligenceProjectBinding,
} from "@/lib/intelligence/runtime";
import {
  beginWorkspaceRequest,
  consumeWorkspaceCredits,
  finishWorkspaceRequest,
  releaseWorkspaceCredits,
  type WorkspaceUsageSnapshot,
} from "@/lib/workspace/usage-policy";

const durableFailureCodeSchema = z.enum([
  "rate-limited",
  "daily-limit-reached",
  "usage-service-unavailable",
  "review-failed",
]);

const usageSnapshotSchema = z
  .object({
    minuteRemaining: z.number().int().nonnegative(),
    minuteResetsAt: z.string().datetime({ offset: true }),
    dailyCreditsRemaining: z.number().int().nonnegative(),
    dailyResetsAt: z.string().datetime({ offset: true }),
    creditCost: z.number().int().nonnegative(),
  })
  .strict();

export const durableIntelligenceOutcomeSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      result: intelligenceRunResponseSchema,
      usage: usageSnapshotSchema,
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: durableFailureCodeSchema,
          message: z.string().min(1).max(300),
          retryAfter: z.number().int().positive().max(86_400).optional(),
        })
        .strict(),
      usage: usageSnapshotSchema.optional(),
    })
    .strict(),
]);

export type DurableIntelligenceOutcome = z.infer<
  typeof durableIntelligenceOutcomeSchema
>;

export type DurableIntelligenceWorkflowInput = Readonly<{
  databaseRunId: string;
  organizationId: string;
  requestId: string;
  request: IntelligenceRunRequest;
  safetyIdentifier: string;
  usageKey: string;
  reservedProviderCalls: number;
  actorUserId?: string;
}>;

type UsageReservation =
  | Readonly<{
      allowed: true;
      usageKey: string;
      leaseId: string;
      reservationId: string;
      usage: WorkspaceUsageSnapshot;
    }>
  | Readonly<{
      allowed: false;
      outcome: DurableIntelligenceOutcome;
    }>;

async function readExistingOutcome(runId: string) {
  "use step";

  const run = getRun<DurableIntelligenceOutcome>(runId);
  return durableIntelligenceOutcomeSchema.parse(await run.returnValue);
}

async function markRunStarted(
  input: DurableIntelligenceWorkflowInput,
  workflowRunId: string,
) {
  "use step";

  const client = createServiceCloudClient();
  if (!client) throw new Error("Cloud workflow persistence is not configured.");
  const { error } = await client
    .from("intelligence_runs")
    .update({ status: "running", workflow_run_id: workflowRunId })
    .eq("id", input.databaseRunId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error("The review run could not be marked as running.");
}

async function reserveRunUsage(
  input: DurableIntelligenceWorkflowInput,
): Promise<UsageReservation> {
  "use step";

  const { stepId } = getStepMetadata();
  const admission = await beginWorkspaceRequest(input.usageKey, stepId);
  if (!admission.allowed) {
    const unavailable = admission.reason === "unavailable";
    return {
      allowed: false,
      outcome: {
        ok: false,
        error: {
          code: unavailable
            ? "usage-service-unavailable"
            : "rate-limited",
          message: unavailable
            ? "Distributed review capacity is temporarily unavailable. No project content was sent to a model."
            : "The review start or concurrency limit has been reached. Try again after the stated interval.",
          retryAfter: admission.retryAfter,
        },
        usage: admission.usage,
      },
    };
  }

  const credits = await consumeWorkspaceCredits(
    admission.usageKey,
    input.request.depth,
    input.reservedProviderCalls,
    `${stepId}:credits`,
  );
  if (!credits.allowed) {
    await finishWorkspaceRequest(admission.usageKey, admission.leaseId);
    const unavailable = credits.reason === "unavailable";
    return {
      allowed: false,
      outcome: {
        ok: false,
        error: {
          code: unavailable
            ? "usage-service-unavailable"
            : "daily-limit-reached",
          message: unavailable
            ? "Distributed usage accounting is temporarily unavailable. No project content was sent to a model."
            : "The daily review allowance has been reached. Continue locally or try again after the reset.",
          retryAfter: credits.retryAfter,
        },
        usage: credits.usage,
      },
    };
  }

  return {
    allowed: true,
    usageKey: admission.usageKey,
    leaseId: admission.leaseId,
    reservationId: `${stepId}:credits`,
    usage: credits.usage,
  };
}

async function executeDurableReview(input: DurableIntelligenceWorkflowInput) {
  "use step";

  const request = intelligenceRunRequestSchema.parse(input.request);
  validateIntelligenceProjectBinding(request);
  return executeIntelligenceRun(request, {
    requestSignal: AbortSignal.timeout(INTELLIGENCE_RUN_TIMEOUT_MS + 5_000),
    safetyIdentifier: input.safetyIdentifier,
    runId: input.requestId,
  });
}

async function releaseRunUsage(usageKey: string, leaseId: string) {
  "use step";
  await finishWorkspaceRequest(usageKey, leaseId);
}

async function refundRunCredits(usageKey: string, reservationId: string) {
  "use step";
  await releaseWorkspaceCredits(usageKey, reservationId);
}

async function finalizeRun(
  input: DurableIntelligenceWorkflowInput,
  workflowRunId: string,
  outcome: DurableIntelligenceOutcome,
) {
  "use step";

  const client = createServiceCloudClient();
  if (!client) throw new Error("Cloud workflow persistence is not configured.");
  const completedAt = new Date().toISOString();
  const result = outcome.ok ? outcome.result : null;
  const { error: updateError } = await client
    .from("intelligence_runs")
    .update({
      workflow_run_id: workflowRunId,
      status: outcome.ok ? "completed" : "failed",
      provider: result?.source ?? null,
      model: result?.model ?? null,
      result,
      error_code: outcome.ok ? null : outcome.error.code,
      completed_at: completedAt,
    })
    .eq("id", input.databaseRunId)
    .eq("organization_id", input.organizationId);
  if (updateError) throw new Error("The review run could not be finalized.");

  if (result) {
    const usage = result.provenance.usage;
    const { error: usageError } = await client.from("usage_records").upsert(
      {
        organization_id: input.organizationId,
        user_id: input.actorUserId ?? null,
        run_id: input.databaseRunId,
        feature: "durable-intelligence-review",
        provider: result.source,
        model: result.model,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cost_microunits: 0,
      },
      { onConflict: "run_id,feature" },
    );
    if (usageError) throw new Error("The review usage record could not be saved.");
  }

  const { error: auditError } = await client.from("audit_events").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId ?? null,
    action: outcome.ok ? "intelligence.run.completed" : "intelligence.run.failed",
    target_type: "intelligence-run",
    target_id: input.databaseRunId,
    request_id: input.requestId,
    metadata: {
      workflowRunId,
      source: result?.source ?? null,
      model: result?.model ?? null,
      status: outcome.ok ? outcome.result.status : outcome.error.code,
    },
  });
  if (auditError) throw new Error("The review audit record could not be saved.");

  logOperationalEvent(
    outcome.ok ? "info" : "warn",
    outcome.ok
      ? "intelligence.workflow.completed"
      : "intelligence.workflow.rejected",
    {
      requestId: input.requestId,
      workflowRunId,
      databaseRunId: input.databaseRunId,
      status: outcome.ok ? outcome.result.status : outcome.error.code,
      model: result?.model,
    },
  );
}

export async function runDurableIntelligenceReview(
  input: DurableIntelligenceWorkflowInput,
): Promise<DurableIntelligenceOutcome> {
  "use workflow";

  using claim = createHook({
    token: `kingxford-intelligence:${input.databaseRunId}`,
  });
  const conflict = await claim.getConflict();
  if (conflict) return readExistingOutcome(conflict.runId);

  const { workflowRunId } = getWorkflowMetadata();
  await markRunStarted(input, workflowRunId);

  const reservation = await reserveRunUsage(input);
  if (!reservation.allowed) {
    await finalizeRun(input, workflowRunId, reservation.outcome);
    return reservation.outcome;
  }

  let outcome: DurableIntelligenceOutcome;
  // Credits are reserved before the run; they are returned only when the run
  // reached no provider at all, so a misconfigured model route cannot drain a
  // day's allowance through repeated immediate failures.
  let refundReservedCredits = false;
  try {
    const result = intelligenceRunResponseSchema.parse(
      await executeDurableReview(input),
    );
    refundReservedCredits = result.provenance.providerCalls.length === 0;
    outcome = { ok: true, result, usage: reservation.usage };
  } catch {
    refundReservedCredits = true;
    outcome = {
      ok: false,
      error: {
        code: "review-failed",
        message:
          "The review could not be completed. No project revision was applied and no phase gate changed.",
      },
      usage: reservation.usage,
    };
  } finally {
    if (refundReservedCredits) {
      await refundRunCredits(reservation.usageKey, reservation.reservationId);
    }
    await releaseRunUsage(reservation.usageKey, reservation.leaseId);
  }

  await finalizeRun(input, workflowRunId, outcome);
  return outcome;
}
