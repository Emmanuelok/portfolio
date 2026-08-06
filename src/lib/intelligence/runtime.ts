import { createHash, randomUUID } from "node:crypto";

import {
  createPlannerAgent,
  createSpecialistAgent,
  createSynthesisAgent,
  getIntelligenceModelRoute,
} from "@/lib/intelligence/agents";
import {
  INTELLIGENCE_PROTOCOL_VERSION,
  intelligenceReviewSchema,
  intelligenceRunResponseSchema,
  type IntelligenceReview,
  type IntelligenceRunRequest,
  type IntelligenceRunResponse,
  type IntelligenceSpecialistRole,
} from "@/lib/intelligence/contracts";
import {
  buildGovernedPhasePlan,
  negotiateCapabilities,
  selectSpecialistRoles,
} from "@/lib/intelligence/policy";
import {
  buildPlannerPrompt,
  buildSpecialistPrompt,
  buildSynthesisPrompt,
  serializeIntelligenceInput,
  type CanonicalIntelligenceInput,
} from "@/lib/intelligence/prompt";
import { buildLocalReview } from "@/lib/workspace/local-analysis";
import { hashRevisionBody } from "@/lib/workspace/project-graph";
import { parseProjectSnapshot } from "@/lib/workspace/project-snapshot-schema";

export const MAX_PROVIDER_CALLS = 4;
export const INTELLIGENCE_ATTEMPT_TIMEOUT_MS = 52_000;
export const INTELLIGENCE_RUN_TIMEOUT_MS = 112_000;

type ProviderFailureCode =
  | "attempt-timeout"
  | "client-aborted"
  | "invalid-output"
  | "auth-rejected"
  | "budget-exhausted"
  | "rate-limited"
  | "request-rejected"
  | "provider-unavailable"
  | "unknown-failure";

type ProviderStage = "plan" | "specialist" | "synthesis";
type ProviderRole = "conductor" | IntelligenceSpecialistRole;
type CallTrace = IntelligenceRunResponse["provenance"]["providerCalls"][number];
type ProjectBinding = IntelligenceRunResponse["projectContext"];

type PlanOutput = Readonly<{
  summary: string;
  phaseObjective: string;
  sequence: readonly string[];
  acceptanceCriteria: readonly string[];
  conflicts: readonly string[];
  boundaries: readonly string[];
  handoff: string;
}>;

export type IntelligenceTokenUsage = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}>;

type ProviderResult<T> = Readonly<{
  output: T;
  model: string;
  usage?: Partial<IntelligenceTokenUsage>;
}>;

export type IntelligenceProvider = Readonly<{
  plan: (
    prompt: string,
    depth: IntelligenceRunRequest["depth"],
    model: string,
    safetyIdentifier: string,
    signal: AbortSignal,
  ) => Promise<ProviderResult<PlanOutput>>;
  specialize: (
    role: IntelligenceSpecialistRole,
    prompt: string,
    depth: IntelligenceRunRequest["depth"],
    model: string,
    safetyIdentifier: string,
    signal: AbortSignal,
  ) => Promise<ProviderResult<IntelligenceReview>>;
  synthesize: (
    prompt: string,
    depth: IntelligenceRunRequest["depth"],
    model: string,
    safetyIdentifier: string,
    signal: AbortSignal,
  ) => Promise<ProviderResult<IntelligenceReview>>;
}>;

class InvalidProviderOutputError extends Error {
  constructor() {
    super("The provider returned no structured output.");
    this.name = "InvalidProviderOutputError";
  }
}

export class IntelligenceProjectBindingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntelligenceProjectBindingError";
  }
}

export class IntelligenceRunCancelledError extends Error {
  constructor() {
    super("The project review was cancelled before it completed.");
    this.name = "IntelligenceRunCancelledError";
  }
}

function normalizedTokenCount(value: number | undefined) {
  return Number.isFinite(value) && (value ?? -1) >= 0
    ? Math.floor(value as number)
    : 0;
}

function normalizeUsage(
  usage: Partial<IntelligenceTokenUsage> | undefined,
): IntelligenceTokenUsage {
  const inputTokens = normalizedTokenCount(usage?.inputTokens);
  const outputTokens = normalizedTokenCount(usage?.outputTokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens:
      usage?.totalTokens === undefined
        ? inputTokens + outputTokens
        : normalizedTokenCount(usage.totalTokens),
  };
}

function aggregateUsage(calls: readonly CallTrace[]): IntelligenceTokenUsage {
  return calls.reduce<IntelligenceTokenUsage>(
    (total, call) => ({
      inputTokens: total.inputTokens + call.usage.inputTokens,
      outputTokens: total.outputTokens + call.usage.outputTokens,
      totalTokens: total.totalTokens + call.usage.totalTokens,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  );
}

const defaultProvider: IntelligenceProvider = {
  async plan(prompt, depth, model, safetyIdentifier, signal) {
    const result = await createPlannerAgent(depth, model, safetyIdentifier).generate({
      prompt,
      abortSignal: signal,
    });
    if (!result.output) throw new InvalidProviderOutputError();
    return {
      output: result.output,
      model: result.response.modelId || model,
      usage: result.usage,
    };
  },
  async specialize(role, prompt, depth, model, safetyIdentifier, signal) {
    const result = await createSpecialistAgent(
      role,
      depth,
      model,
      safetyIdentifier,
    ).generate({
      prompt,
      abortSignal: signal,
    });
    if (!result.output) throw new InvalidProviderOutputError();
    return {
      output: intelligenceReviewSchema.parse(result.output),
      model: result.response.modelId || model,
      usage: result.usage,
    };
  },
  async synthesize(prompt, depth, model, safetyIdentifier, signal) {
    const result = await createSynthesisAgent(depth, model, safetyIdentifier).generate({
      prompt,
      abortSignal: signal,
    });
    if (!result.output) throw new InvalidProviderOutputError();
    return {
      output: intelligenceReviewSchema.parse(result.output),
      model: result.response.modelId || model,
      usage: result.usage,
    };
  },
};

function digest(value: unknown) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

function normalizeModel(model: string) {
  return model.replace(/^openai\//, "");
}

function nowIso(now: () => Date) {
  return now().toISOString();
}

function statusCodeFrom(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { statusCode?: unknown; cause?: unknown };
  if (typeof candidate.statusCode === "number") return candidate.statusCode;
  if (candidate.cause && typeof candidate.cause === "object") {
    const cause = candidate.cause as { statusCode?: unknown };
    if (typeof cause.statusCode === "number") return cause.statusCode;
  }
  return undefined;
}

function classifyProviderFailure(
  error: unknown,
  requestAborted: boolean,
  timedOut: boolean,
): ProviderFailureCode {
  if (requestAborted) return "client-aborted";
  if (timedOut) return "attempt-timeout";
  if (error instanceof InvalidProviderOutputError) return "invalid-output";
  const status = statusCodeFrom(error);
  if (status === 401 || status === 403) return "auth-rejected";
  if (status === 402) return "budget-exhausted";
  if (status === 429) return "rate-limited";
  if (status !== undefined && status >= 400 && status < 500) {
    return "request-rejected";
  }
  if (status !== undefined && status >= 500) return "provider-unavailable";
  return "unknown-failure";
}

function workspaceRevisionBody(request: IntelligenceRunRequest) {
  return request.mode === "code"
    ? ({ type: "code", ...request.code } as const)
    : ({ type: "text", text: request.text } as const);
}

const workspaceArtifactKind = {
  idea: "idea",
  code: "code",
  mindmap: "system-map",
  prompt: "prompt",
  brief: "brief",
} as const satisfies Record<IntelligenceRunRequest["mode"], string>;

export function validateIntelligenceProjectBinding(
  request: IntelligenceRunRequest,
): ProjectBinding {
  const snapshot = parseProjectSnapshot(request.projectGraphSnapshot);
  if (
    snapshot.project.id !== request.projectContext.projectId ||
    snapshot.project.activePhase !== request.projectContext.phase
  ) {
    throw new IntelligenceProjectBindingError(
      "The project graph snapshot does not match the active project context.",
    );
  }

  const artifact = snapshot.artifacts.find(
    (candidate) => candidate.activeRevision.id === request.artifactRevisionId,
  );
  if (!artifact) {
    throw new IntelligenceProjectBindingError(
      "The selected artifact revision is not active in this project snapshot.",
    );
  }
  if (artifact.kind !== workspaceArtifactKind[request.mode]) {
    throw new IntelligenceProjectBindingError(
      "The selected artifact does not match the active workspace mode.",
    );
  }

  const draftHash = hashRevisionBody(workspaceRevisionBody(request));
  if (draftHash !== artifact.activeRevision.contentHash) {
    throw new IntelligenceProjectBindingError(
      "The workspace draft no longer matches the selected artifact revision.",
    );
  }

  return {
    projectId: snapshot.project.id,
    snapshotId: snapshot.id,
    snapshotHash: snapshot.hash,
    snapshotSchemaVersion: snapshot.schemaVersion,
    snapshotCharacterCount: snapshot.characterCount,
    artifactRevisionId: request.artifactRevisionId,
    artifactId: artifact.id,
    draftHash,
    counts: {
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      artifacts: snapshot.artifacts.length,
      revisions: snapshot.artifacts.length,
      reviews: snapshot.reviewLinks.length,
      decisions: snapshot.decisions.length,
      gates: snapshot.gates.length,
    },
  };
}

function localReview(request: IntelligenceRunRequest) {
  const review = buildLocalReview({
    mode: request.mode,
    title: request.title,
    text: request.text,
    code: request.code,
  });
  const improvedCode =
    request.mode === "code"
      ? {
          ...request.code,
          html:
            request.code.html ||
            '<main><h1>Start your prototype</h1><p>Define the first user action and evidence threshold.</p></main>',
        }
      : null;
  return intelligenceReviewSchema.parse({
    summary: review.summary.slice(0, 1_600),
    status: review.status,
    strengths: review.strengths.map((item) => item.slice(0, 500)).slice(0, 6),
    uncertainties: review.uncertainties.map((item) => item.slice(0, 500)).slice(0, 6),
    failurePoints: review.failurePoints.map((item) => item.slice(0, 500)).slice(0, 6),
    assumptions: review.assumptions.map((item) => item.slice(0, 500)).slice(0, 6),
    nextTest: review.nextTest.slice(0, 1_200),
    proposedChanges: review.proposedChanges
      .map((item) => item.slice(0, 600))
      .slice(0, 8),
    improvedInput: (
      improvedCode?.html || review.improvedInput || "Define the first source version."
    ).slice(0, 20_000),
    improvedCode,
    buildBrief: {
      title: (review.buildBrief.title || "Untitled project").slice(0, 160),
      oneLine: (review.buildBrief.oneLine || "Define the intended change.").slice(0, 700),
      audience: (review.buildBrief.audience || "Define the primary audience.").slice(0, 700),
      coreExperience: (
        review.buildBrief.coreExperience || "Define the smallest complete experience."
      ).slice(0, 900),
      deliverables: review.buildBrief.deliverables
        .map((item) => item.slice(0, 300))
        .slice(0, 8),
      complexity: review.buildBrief.complexity,
    },
  });
}

class ProviderCallLedger {
  private readonly traces: Array<Readonly<{ ordinal: number; trace: CallTrace }>> = [];
  private reservedCalls = 0;

  constructor(
    private readonly requestSignal: AbortSignal,
    private readonly runSignal: AbortSignal,
    private readonly now: () => Date,
  ) {}

  get calls(): CallTrace[] {
    return [...this.traces]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map(({ trace }) => trace);
  }

  get remaining() {
    return MAX_PROVIDER_CALLS - this.reservedCalls;
  }

  async execute<T>(options: Readonly<{
    stage: ProviderStage;
    role: ProviderRole;
    model: string;
    inputDigest: string;
    action: (signal: AbortSignal) => Promise<ProviderResult<T>>;
  }>): Promise<ProviderResult<T> | null> {
    if (this.remaining <= 0) return null;

    // Reserve synchronously before awaiting so parallel specialists can never
    // race past the hard four-call ceiling.
    const ordinal = this.reservedCalls;
    this.reservedCalls += 1;
    const id = `call-${randomUUID()}`;
    const started = this.now();
    const timeoutSignal = AbortSignal.timeout(INTELLIGENCE_ATTEMPT_TIMEOUT_MS);
    const signal = AbortSignal.any([
      this.requestSignal,
      this.runSignal,
      timeoutSignal,
    ]);
    try {
      const result = await options.action(signal);
      const completed = this.now();
      this.traces.push({
        ordinal,
        trace: {
          id,
          stage: options.stage,
          role: options.role,
          model: normalizeModel(result.model || options.model),
          status: "completed",
          startedAt: started.toISOString(),
          completedAt: completed.toISOString(),
          latencyMs: Math.min(
            120_000,
            Math.max(0, completed.getTime() - started.getTime()),
          ),
          inputDigest: options.inputDigest,
          outputDigest: digest(result.output),
          usage: normalizeUsage(result.usage),
        },
      });
      return result;
    } catch (error) {
      const completed = this.now();
      const failureCode = classifyProviderFailure(
        error,
        this.requestSignal.aborted,
        this.runSignal.aborted || timeoutSignal.aborted,
      );
      this.traces.push({
        ordinal,
        trace: {
          id,
          stage: options.stage,
          role: options.role,
          model: normalizeModel(options.model),
          status:
            failureCode === "client-aborted"
              ? "cancelled"
              : failureCode === "attempt-timeout"
                ? "timed-out"
                : "failed",
          startedAt: started.toISOString(),
          completedAt: completed.toISOString(),
          latencyMs: Math.min(
            120_000,
            Math.max(0, completed.getTime() - started.getTime()),
          ),
          inputDigest: options.inputDigest,
          outputDigest: null,
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          failureCode,
        },
      });
      console.error("[intelligence-runtime] provider_call_failed", {
        stage: options.stage,
        role: options.role,
        failureCode,
      });
      return null;
    }
  }
}

function artifact(
  kind: IntelligenceRunResponse["artifacts"][number]["kind"],
  title: string,
  phase: IntelligenceRunRequest["projectContext"]["phase"],
  role: ProviderRole,
  value: unknown,
  parentArtifactIds: readonly string[],
  createdAt: string,
) {
  return {
    id: `artifact-${randomUUID()}`,
    kind,
    title,
    phase,
    role,
    digest: digest(value),
    parentArtifactIds: [...new Set(parentArtifactIds)].slice(0, 48),
    createdAt,
  } as const;
}

function baseRunContext(
  request: IntelligenceRunRequest,
  now: () => Date,
  options: Readonly<{ runId?: string; startedAt?: string }> = {},
) {
  const projectContext = validateIntelligenceProjectBinding(request);
  const capabilityNegotiation = negotiateCapabilities(
    request.capabilityNegotiation.requested,
  );
  const canonical = serializeIntelligenceInput(request, capabilityNegotiation);
  const roles = selectSpecialistRoles(
    request.projectContext.phase,
    request.orchestration.requestedRoles,
    request.orchestration.maxSpecialistPasses,
  );
  return {
    capabilityNegotiation,
    canonical,
    roles,
    projectContext,
    runId: options.runId || `run-${randomUUID()}`,
    startedAt: options.startedAt || nowIso(now),
    parentArtifactIds: Array.from(
      new Set([
        projectContext.artifactId,
        ...request.projectContext.artifacts.map((item) => item.id),
      ]),
    ).slice(0, 32),
  };
}

export function executeLocalIntelligenceRun(
  request: IntelligenceRunRequest,
  options: Readonly<{
    now?: () => Date;
    notice?: string;
    providerCalls?: readonly CallTrace[];
    runId?: string;
    startedAt?: string;
  }> = {},
): IntelligenceRunResponse {
  const now = options.now || (() => new Date());
  const context = baseRunContext(request, now, options);
  const providerCalls = [...(options.providerCalls || [])].slice(0, MAX_PROVIDER_CALLS);
  const plan = buildGovernedPhasePlan(request.projectContext.phase, context.roles);
  const createdAt = nowIso(now);
  const planArtifact = artifact(
    "conductor-plan",
    `${request.projectContext.phase} phase plan`,
    request.projectContext.phase,
    "conductor",
    plan,
    context.parentArtifactIds,
    createdAt,
  );
  const baseReview = localReview(request);
  const passResults = context.roles.map((role) => {
    const review = intelligenceReviewSchema.parse({
      ...baseReview,
      summary: `${role[0].toUpperCase()}${role.slice(1)} local lens: ${baseReview.summary}`.slice(
        0,
        1_600,
      ),
    });
    const passArtifact = artifact(
      "specialist-review",
      `${role} specialist review`,
      request.projectContext.phase,
      role,
      review,
      [planArtifact.id],
      createdAt,
    );
    return {
      pass: {
        id: `pass-${randomUUID()}`,
        role,
        status: "completed" as const,
        source: "local" as const,
        model: "local-readiness-rules-v1",
        review,
        inputDigest: digest(`${context.canonical.inputDigest}:${role}`),
        outputDigest: passArtifact.digest,
        artifactId: passArtifact.id,
        notice: "Local rule-based review; no model or external tool was used.",
      },
      artifact: passArtifact,
    };
  });
  const synthesisArtifact = artifact(
    "synthesis",
    "Conductor synthesis",
    request.projectContext.phase,
    "conductor",
    baseReview,
    passResults.length
      ? passResults.map((item) => item.artifact.id)
      : [planArtifact.id],
    createdAt,
  );
  return intelligenceRunResponseSchema.parse({
    runId: context.runId,
    status: "local-fallback",
    review: baseReview,
    source: "local",
    model: "local-readiness-rules-v1",
    phase: request.projectContext.phase,
    agentRole: "conductor",
    protocolVersion: INTELLIGENCE_PROTOCOL_VERSION,
    inputDigest: context.canonical.inputDigest,
    orchestration: {
      plan,
      passes: passResults.map((item) => item.pass),
    },
    capabilityNegotiation: context.capabilityNegotiation,
    artifacts: [
      planArtifact,
      ...passResults.map((item) => item.artifact),
      synthesisArtifact,
    ],
    provenance: {
      providerCalls,
      parentArtifactIds: context.parentArtifactIds,
      finalArtifactId: synthesisArtifact.id,
      usage: aggregateUsage(providerCalls),
    },
    startedAt: context.startedAt,
    completedAt: nowIso(now),
    projectContext: context.projectContext,
    notice:
      options.notice ||
      "AI generation is not configured. This result comes from local rule-based checks; it did not browse, execute code, validate evidence, change the project, or record gate approval.",
  });
}

async function callPlan(
  provider: IntelligenceProvider,
  ledger: ProviderCallLedger,
  canonical: CanonicalIntelligenceInput,
  request: IntelligenceRunRequest,
  roles: readonly IntelligenceSpecialistRole[],
  safetyIdentifier: string,
  model: string,
) {
  const prompt = buildPlannerPrompt(canonical, roles);
  return ledger.execute({
    stage: "plan",
    role: "conductor",
    model,
    inputDigest: digest(prompt),
    action: (signal) =>
      provider.plan(prompt, request.depth, model, safetyIdentifier, signal),
  });
}

export async function executeIntelligenceRun(
  request: IntelligenceRunRequest,
  options: Readonly<{
    requestSignal: AbortSignal;
    safetyIdentifier: string;
    provider?: IntelligenceProvider;
    now?: () => Date;
    runId?: string;
  }>,
): Promise<IntelligenceRunResponse> {
  const now = options.now || (() => new Date());
  const provider = options.provider || defaultProvider;
  const context = baseRunContext(request, now, { runId: options.runId });
  const modelRoute = getIntelligenceModelRoute(request.depth);
  const runTimeoutSignal = AbortSignal.timeout(INTELLIGENCE_RUN_TIMEOUT_MS);
  const ledger = new ProviderCallLedger(options.requestSignal, runTimeoutSignal, now);

  const plannerResult = await callPlan(
    provider,
    ledger,
    context.canonical,
    request,
    context.roles,
    options.safetyIdentifier,
    modelRoute.model,
  );

  if (options.requestSignal.aborted) throw new IntelligenceRunCancelledError();
  if (!plannerResult) {
    return executeLocalIntelligenceRun(request, {
      now,
      runId: context.runId,
      startedAt: context.startedAt,
      providerCalls: ledger.calls,
      notice:
        "The AI planning step was unavailable. No project content changed; this run uses local rule-based analysis.",
    });
  }

  const plan = buildGovernedPhasePlan(
    request.projectContext.phase,
    context.roles,
    plannerResult.output,
  );
  const createdAt = nowIso(now);
  const planArtifact = artifact(
    "conductor-plan",
    `${request.projectContext.phase} phase plan`,
    request.projectContext.phase,
    "conductor",
    plan,
    context.parentArtifactIds,
    createdAt,
  );

  // The planner uses one call and one call is always reserved for synthesis.
  const specialistRoles = context.roles.slice(0, Math.max(0, ledger.remaining - 1));
  const passResults = await Promise.all(
    specialistRoles.map(async (role) => {
      const prompt = buildSpecialistPrompt(context.canonical, plan, role);
      const passInputDigest = digest(prompt);
      const result = await ledger.execute({
        stage: "specialist",
        role,
        model: modelRoute.model,
        inputDigest: passInputDigest,
        action: (signal) =>
          provider.specialize(
            role,
            prompt,
            request.depth,
            modelRoute.model,
            options.safetyIdentifier,
            signal,
          ),
      });
      if (!result) {
        return {
          pass: {
            id: `pass-${randomUUID()}`,
            role,
            status: "failed" as const,
            source: "openai" as const,
            model: normalizeModel(modelRoute.model),
            review: null,
            inputDigest: passInputDigest,
            outputDigest: null,
            artifactId: null,
            notice: "This specialist review did not complete; the run records it as incomplete.",
          },
          artifact: null,
        };
      }
      const review = intelligenceReviewSchema.parse(result.output);
      const passArtifact = artifact(
        "specialist-review",
        `${role} specialist review`,
        request.projectContext.phase,
        role,
        review,
        [planArtifact.id],
        nowIso(now),
      );
      return {
        pass: {
          id: `pass-${randomUUID()}`,
          role,
          status: "completed" as const,
          source: "openai" as const,
          model: normalizeModel(result.model),
          review,
          inputDigest: passInputDigest,
          outputDigest: passArtifact.digest,
          artifactId: passArtifact.id,
        },
        artifact: passArtifact,
      };
    }),
  );

  if (options.requestSignal.aborted) throw new IntelligenceRunCancelledError();

  const completedPasses = passResults.flatMap((item) =>
    item.pass.review
      ? [{ role: item.pass.role, review: item.pass.review }]
      : [],
  );
  const synthesisPrompt = buildSynthesisPrompt(
    context.canonical,
    plan,
    completedPasses,
  );
  const synthesisResult = await ledger.execute({
    stage: "synthesis",
    role: "conductor",
    model: modelRoute.model,
    inputDigest: digest(synthesisPrompt),
    action: (signal) =>
      provider.synthesize(
        synthesisPrompt,
        request.depth,
        modelRoute.model,
        options.safetyIdentifier,
        signal,
      ),
  });

  if (options.requestSignal.aborted) throw new IntelligenceRunCancelledError();

  const review = synthesisResult
    ? intelligenceReviewSchema.parse(synthesisResult.output)
    : localReview(request);
  const successfulArtifacts = passResults.flatMap((item) =>
    item.artifact ? [item.artifact] : [],
  );
  const synthesisArtifact = artifact(
    "synthesis",
    "Conductor synthesis",
    request.projectContext.phase,
    "conductor",
    review,
    successfulArtifacts.length
      ? successfulArtifacts.map((item) => item.id)
      : [planArtifact.id],
    nowIso(now),
  );
  const allSpecialistsCompleted = passResults.every(
    (item) => item.pass.status === "completed",
  );
  const status = synthesisResult && allSpecialistsCompleted ? "completed" : "partial";
  const providerCalls = ledger.calls;
  const primaryModel = normalizeModel(modelRoute.model);
  const usedGatewayFallback = providerCalls.some(
    (call) => call.status === "completed" && call.model !== primaryModel,
  );

  return intelligenceRunResponseSchema.parse({
    runId: context.runId,
    status,
    review,
    source: synthesisResult ? "openai" : "local",
    model: synthesisResult
      ? normalizeModel(synthesisResult.model)
      : "local-readiness-rules-v1",
    phase: request.projectContext.phase,
    agentRole: "conductor",
    protocolVersion: INTELLIGENCE_PROTOCOL_VERSION,
    inputDigest: context.canonical.inputDigest,
    orchestration: {
      plan,
      passes: passResults.map((item) => item.pass),
    },
    capabilityNegotiation: context.capabilityNegotiation,
    artifacts: [planArtifact, ...successfulArtifacts, synthesisArtifact],
    provenance: {
      providerCalls,
      parentArtifactIds: context.parentArtifactIds,
      finalArtifactId: synthesisArtifact.id,
      usage: aggregateUsage(providerCalls),
    },
    startedAt: context.startedAt,
    completedAt: nowIso(now),
    projectContext: context.projectContext,
    ...(status === "partial"
      ? {
          notice:
            "One or more specialist steps used a fallback or did not complete. No proposal was applied and no gate was approved. Review the run details before accepting this result.",
        }
      : usedGatewayFallback
        ? {
            notice:
              "AI Gateway used an approved fallback model for one or more steps. Review each step’s source before accepting the result.",
          }
      : {}),
  });
}
