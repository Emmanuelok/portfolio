import { createHash } from "node:crypto";

import {
  councilChallengeSchema,
  councilMoveSchema,
  councilSurveySchema,
  councilSynthesisSchema,
  COUNCIL_BOUNDARIES,
  COUNCIL_PROTOCOL_VERSION,
  type CouncilChallenge,
  type CouncilDeliberation,
  type CouncilLens,
  type CouncilMove,
  type CouncilSessionRequest,
  type CouncilSessionResult,
  type CouncilStageEvent,
  type CouncilSurvey,
  type CouncilSynthesis,
} from "@/lib/council/contracts";
import {
  createChairAgent,
  createChallengerAgent,
  createProposerAgent,
  createSurveyorAgent,
  getCouncilModelRoute,
  type CouncilDepth,
} from "@/lib/council/agents";
import { executeLocalCouncilSession } from "@/lib/council/local-council";
import {
  buildChallengePrompt,
  buildProposalPrompt,
  buildSurveyPrompt,
  buildSynthesisPrompt,
  serializeCouncilInput,
} from "@/lib/council/prompt";

export const COUNCIL_ATTEMPT_TIMEOUT_MS = 35_000;
export const COUNCIL_SESSION_TIMEOUT_MS = 105_000;
export const MAX_COUNCIL_PROVIDER_CALLS = 10;

export type CouncilTokenUsage = Readonly<{
  inputTokens: number;
  outputTokens: number;
}>;

export type CouncilProviderResult<T> = Readonly<{
  output: T;
  model: string;
  usage?: Readonly<{ inputTokens?: number; outputTokens?: number }>;
}>;

export type CouncilProvider = Readonly<{
  survey(
    prompt: string,
    depth: CouncilDepth,
    model: string,
    safetyIdentifier: string,
    signal: AbortSignal,
  ): Promise<CouncilProviderResult<CouncilSurvey>>;
  propose(
    lens: CouncilLens,
    prompt: string,
    depth: CouncilDepth,
    model: string,
    safetyIdentifier: string,
    signal: AbortSignal,
  ): Promise<CouncilProviderResult<CouncilMove>>;
  challenge(
    lens: CouncilLens,
    prompt: string,
    depth: CouncilDepth,
    model: string,
    safetyIdentifier: string,
    signal: AbortSignal,
  ): Promise<CouncilProviderResult<CouncilChallenge>>;
  synthesize(
    prompt: string,
    depth: CouncilDepth,
    model: string,
    safetyIdentifier: string,
    signal: AbortSignal,
  ): Promise<CouncilProviderResult<CouncilSynthesis>>;
}>;

export class CouncilCancelledError extends Error {
  constructor() {
    super("The council session was cancelled.");
    this.name = "CouncilCancelledError";
  }
}

class InvalidCouncilOutputError extends Error {
  constructor() {
    super("The provider returned no structured council output.");
    this.name = "InvalidCouncilOutputError";
  }
}

const defaultProvider: CouncilProvider = {
  async survey(prompt, depth, model, safetyIdentifier, signal) {
    const result = await createSurveyorAgent(depth, model, safetyIdentifier).generate({
      prompt,
      abortSignal: signal,
    });
    if (!result.output) throw new InvalidCouncilOutputError();
    return {
      output: councilSurveySchema.parse(result.output),
      model: result.response.modelId || model,
      usage: result.usage,
    };
  },
  async propose(lens, prompt, depth, model, safetyIdentifier, signal) {
    const result = await createProposerAgent(
      lens,
      depth,
      model,
      safetyIdentifier,
    ).generate({ prompt, abortSignal: signal });
    if (!result.output) throw new InvalidCouncilOutputError();
    return {
      output: councilMoveSchema.parse(result.output),
      model: result.response.modelId || model,
      usage: result.usage,
    };
  },
  async challenge(lens, prompt, depth, model, safetyIdentifier, signal) {
    const result = await createChallengerAgent(
      lens,
      depth,
      model,
      safetyIdentifier,
    ).generate({ prompt, abortSignal: signal });
    if (!result.output) throw new InvalidCouncilOutputError();
    return {
      output: councilChallengeSchema.parse(result.output),
      model: result.response.modelId || model,
      usage: result.usage,
    };
  },
  async synthesize(prompt, depth, model, safetyIdentifier, signal) {
    const result = await createChairAgent(depth, model, safetyIdentifier).generate({
      prompt,
      abortSignal: signal,
    });
    if (!result.output) throw new InvalidCouncilOutputError();
    return {
      output: councilSynthesisSchema.parse(result.output),
      model: result.response.modelId || model,
      usage: result.usage,
    };
  },
};

class CouncilCallBudget {
  private reserved = 0;
  private inputTokens = 0;
  private outputTokens = 0;
  private observedModel = "";

  constructor(
    private readonly requestSignal: AbortSignal,
    private readonly sessionSignal: AbortSignal,
  ) {}

  get remaining() {
    return MAX_COUNCIL_PROVIDER_CALLS - this.reserved;
  }

  get usage(): CouncilTokenUsage & { providerCalls: number } {
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      providerCalls: this.reserved,
    };
  }

  get model() {
    return this.observedModel;
  }

  async execute<T>(
    action: (signal: AbortSignal) => Promise<CouncilProviderResult<T>>,
  ): Promise<CouncilProviderResult<T> | null> {
    if (this.remaining <= 0) return null;

    // Reserve synchronously before awaiting so parallel lenses cannot race
    // past the call ceiling.
    this.reserved += 1;
    const signal = AbortSignal.any([
      this.requestSignal,
      this.sessionSignal,
      AbortSignal.timeout(COUNCIL_ATTEMPT_TIMEOUT_MS),
    ]);

    try {
      const result = await action(signal);
      this.inputTokens += Math.max(0, Math.trunc(result.usage?.inputTokens ?? 0));
      this.outputTokens += Math.max(0, Math.trunc(result.usage?.outputTokens ?? 0));
      if (!this.observedModel && result.model) this.observedModel = result.model;
      return result;
    } catch {
      return null;
    }
  }
}

function sessionIdentity(inputDigest: string, seed: string) {
  return `council_${createHash("sha256")
    .update(`${seed}:${inputDigest}`)
    .digest("hex")
    .slice(0, 32)}`;
}

function deterministicSynthesis(
  deliberations: readonly CouncilDeliberation[],
  notice: string,
): CouncilSynthesis {
  const order = { upheld: 0, qualified: 1, refuted: 2 } as const;
  const ranked = [...deliberations]
    .sort(
      (left, right) =>
        order[left.challenge.verdict] - order[right.challenge.verdict] ||
        left.lens.localeCompare(right.lens),
    )
    .map((item) => item.move.title)
    .slice(0, 6);

  return {
    summary: notice,
    rankedMoveTitles: ranked.length > 0 ? ranked : ["Review the project record"],
    sequenceRationale:
      "Moves that survived challenge are ordered ahead of those that were qualified or refuted.",
    unresolvedConflicts: [
      "The council did not complete a reconciled synthesis, so this ordering reflects challenge verdicts only.",
    ],
    gateReadiness: {
      assessment: "evidence-incomplete",
      rationale:
        "No synthesis was produced for this session, so gate readiness was not assessed. Only a person can record a phase gate decision.",
      satisfiedCriteria: [],
      missingCriteria: [
        "A completed council synthesis is required before gate readiness can be assessed.",
      ],
    },
  };
}

export async function executeCouncilSession(
  request: CouncilSessionRequest,
  options: Readonly<{
    requestSignal: AbortSignal;
    safetyIdentifier: string;
    provider?: CouncilProvider;
    onStage?: (event: CouncilStageEvent) => void;
    now?: () => Date;
    sessionSeed?: string;
  }>,
): Promise<CouncilSessionResult> {
  const now = options.now ?? (() => new Date());
  const provider = options.provider ?? defaultProvider;
  const canonical = serializeCouncilInput(request);
  const sessionId = sessionIdentity(
    canonical.inputDigest,
    options.sessionSeed ?? "session",
  );
  const emit = (event: CouncilStageEvent) => options.onStage?.(event);
  const route = getCouncilModelRoute(request.depth);
  const sessionSignal = AbortSignal.timeout(COUNCIL_SESSION_TIMEOUT_MS);
  const budget = new CouncilCallBudget(options.requestSignal, sessionSignal);

  const fallbackToLocal = () => {
    const local = executeLocalCouncilSession(request, {
      sessionId,
      inputDigest: canonical.inputDigest,
      now,
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
    return local;
  };

  emit({
    stage: "accepted",
    sessionId,
    phase: request.projectContext.phase,
    lenses: request.lenses,
    source: "gateway",
  });

  const surveyResult = await budget.execute((signal) =>
    provider.survey(
      buildSurveyPrompt(canonical),
      request.depth,
      route.model,
      options.safetyIdentifier,
      signal,
    ),
  );

  if (options.requestSignal.aborted) throw new CouncilCancelledError();
  if (!surveyResult) return fallbackToLocal();

  const survey = surveyResult.output;
  emit({ stage: "survey", survey });

  // Each lens runs its own propose-then-challenge chain, so a challenge starts
  // as soon as its move lands rather than waiting for every other lens.
  const chains = request.lenses.map(async (lens): Promise<CouncilDeliberation | null> => {
    const proposal = await budget.execute((signal) =>
      provider.propose(
        lens,
        buildProposalPrompt(canonical, survey, lens),
        request.depth,
        route.model,
        options.safetyIdentifier,
        signal,
      ),
    );
    if (!proposal) return null;

    const id = `${sessionId}:${lens}`;
    const move = proposal.output;
    emit({ stage: "proposal", id, lens, move });

    const challenged = await budget.execute((signal) =>
      provider.challenge(
        lens,
        buildChallengePrompt(canonical, survey, move, lens),
        request.depth,
        route.model,
        options.safetyIdentifier,
        signal,
      ),
    );

    const challenge: CouncilChallenge = challenged?.output ?? {
      verdict: "qualified",
      grounds:
        "This move was not independently challenged, so it has not been tested against the project record.",
      unsupportedClaims: [
        "No challenge verdict was produced for this move.",
      ],
      smallerAlternative: "",
    };
    const survivesChallenge = challenge.verdict !== "refuted";
    emit({ stage: "challenge", id, lens, challenge, survivesChallenge });

    return { id, lens, move, challenge, survivesChallenge };
  });

  const deliberations = (await Promise.all(chains)).filter(
    (item): item is CouncilDeliberation => item !== null,
  );

  if (options.requestSignal.aborted) throw new CouncilCancelledError();
  if (deliberations.length === 0) return fallbackToLocal();

  const synthesisResult = await budget.execute((signal) =>
    provider.synthesize(
      buildSynthesisPrompt(canonical, survey, deliberations),
      request.depth,
      route.model,
      options.safetyIdentifier,
      signal,
    ),
  );

  const synthesis =
    synthesisResult?.output ??
    deterministicSynthesis(
      deliberations,
      "The council completed its proposals and challenges, but the reconciling synthesis step was unavailable. The ordering below reflects challenge verdicts only.",
    );

  const usage = budget.usage;
  const result: CouncilSessionResult = {
    sessionId,
    protocolVersion: COUNCIL_PROTOCOL_VERSION,
    phase: request.projectContext.phase,
    source: "gateway",
    model: budget.model || route.model,
    survey,
    deliberations,
    synthesis,
    boundaries: [
      ...COUNCIL_BOUNDARIES,
      ...(deliberations.length < request.lenses.length
        ? [
            `${request.lenses.length - deliberations.length} of ${request.lenses.length} council members did not return a proposal for this session.`,
          ]
        : []),
    ],
    inputDigest: canonical.inputDigest,
    completedAt: now().toISOString(),
    usage,
  };

  emit({ stage: "complete", result });
  return result;
}
