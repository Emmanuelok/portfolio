import { createHash } from "node:crypto";

import {
  councilLensLabels,
  COUNCIL_BOUNDARIES,
  COUNCIL_PROTOCOL_VERSION,
  type CouncilChallenge,
  type CouncilDeliberation,
  type CouncilLens,
  type CouncilMove,
  type CouncilProjectContext,
  type CouncilSessionRequest,
  type CouncilSessionResult,
  type CouncilSurvey,
  type CouncilSynthesis,
} from "@/lib/council/contracts";
import { PHASE_OPERATING_PLANS } from "@/lib/intelligence/policy";

function truncate(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(1, limit - 1))}…`;
}

type RecordFacts = Readonly<{
  evidenceCount: number;
  decisionCount: number;
  acceptedDecisionCount: number;
  artifactCount: number;
  acceptedRunCount: number;
  evidenceWithoutClaim: readonly string[];
  decisionsWithoutArtifacts: readonly string[];
  linkedEvidenceIds: readonly string[];
}>;

function readRecord(context: CouncilProjectContext): RecordFacts {
  const acceptedDecisions = context.decisions.filter(
    (decision) => decision.status === "accepted",
  );
  return {
    evidenceCount: context.evidence.length,
    decisionCount: context.decisions.length,
    acceptedDecisionCount: acceptedDecisions.length,
    artifactCount: context.artifacts.length,
    acceptedRunCount: context.acceptedRuns.length,
    evidenceWithoutClaim: context.evidence
      .filter((item) => item.claim.trim().length === 0)
      .map((item) => item.title),
    decisionsWithoutArtifacts: context.decisions
      .filter((decision) => decision.relatedArtifactIds.length === 0)
      .map((decision) => decision.title),
    linkedEvidenceIds: context.evidence.slice(0, 4).map((item) => item.id),
  };
}

function localSurvey(
  context: CouncilProjectContext,
  facts: RecordFacts,
): CouncilSurvey {
  const established: string[] = [];
  const assumed: string[] = [];
  const missing: string[] = [];
  const contested: string[] = [];

  if (context.objective.trim()) {
    established.push(
      `The project states an objective: ${truncate(context.objective, 300)}`,
    );
  } else {
    missing.push("The project record contains no stated objective.");
  }

  if (facts.evidenceCount > 0) {
    established.push(
      `${facts.evidenceCount} evidence ${facts.evidenceCount === 1 ? "entry is" : "entries are"} recorded and available to cite.`,
    );
  } else {
    missing.push(
      "No evidence is recorded, so no recommendation can rest on project-held support.",
    );
  }

  if (facts.acceptedDecisionCount > 0) {
    established.push(
      `${facts.acceptedDecisionCount} accepted ${facts.acceptedDecisionCount === 1 ? "decision is" : "decisions are"} recorded.`,
    );
  }

  if (facts.artifactCount > 0) {
    established.push(
      `${facts.artifactCount} ${facts.artifactCount === 1 ? "artifact is" : "artifacts are"} held in the project graph.`,
    );
  }

  for (const title of facts.decisionsWithoutArtifacts.slice(0, 3)) {
    assumed.push(
      `The decision "${truncate(title, 160)}" is recorded without a linked artifact.`,
    );
  }

  for (const title of facts.evidenceWithoutClaim.slice(0, 2)) {
    assumed.push(
      `The evidence "${truncate(title, 160)}" carries no stated claim, so what it supports is unrecorded.`,
    );
  }

  if (facts.decisionCount > 0 && facts.evidenceCount === 0) {
    contested.push(
      "Decisions exist without any recorded evidence, so their basis cannot be checked against the record.",
    );
  }

  const pending = context.decisions.filter(
    (decision) => decision.status !== "accepted",
  );
  if (pending.length > 0 && facts.acceptedDecisionCount > 0) {
    contested.push(
      `${pending.length} recorded ${pending.length === 1 ? "decision remains" : "decisions remain"} unaccepted alongside accepted ones.`,
    );
  }

  if (missing.length === 0) {
    missing.push(
      "This deterministic reading checks record structure only. It cannot judge whether the evidence is sufficient.",
    );
  }

  return {
    positionSummary: truncate(
      `The record holds ${facts.evidenceCount} evidence ${facts.evidenceCount === 1 ? "entry" : "entries"}, ${facts.decisionCount} ${facts.decisionCount === 1 ? "decision" : "decisions"}, and ${facts.artifactCount} ${facts.artifactCount === 1 ? "artifact" : "artifacts"} at the ${context.phase} phase. This reading is derived locally from record structure without a provider review.`,
      1_400,
    ),
    established: established.slice(0, 6),
    assumed: assumed.slice(0, 6),
    missing: missing.slice(0, 6),
    contested: contested.slice(0, 4),
  };
}

function localMove(
  lens: CouncilLens,
  context: CouncilProjectContext,
  facts: RecordFacts,
): CouncilMove {
  const unsupported = facts.evidenceCount === 0;
  const evidenceBasis = {
    evidenceIds: unsupported ? [] : [...facts.linkedEvidenceIds],
    decisionIds: [] as string[],
    unsupported,
    note: unsupported
      ? "The record contains no evidence to cite for this move."
      : "Cited from evidence entries present in the project record.",
  };

  if (lens === "evidence-gap") {
    return {
      title: unsupported
        ? "Record the first evidence entry"
        : "Attach claims to the evidence already held",
      action: unsupported
        ? "Add one evidence entry to the project record for the claim the current direction most depends on, with its source and what it supports."
        : `Review the ${facts.evidenceCount} recorded evidence ${facts.evidenceCount === 1 ? "entry" : "entries"} and state, for each, the specific claim it supports and the decision it informs.`,
      rationale:
        "Recommendations can only be checked against the record when evidence carries an explicit claim.",
      expectedOutcome:
        "Each claim in the project can be traced to a recorded source or is visibly marked unsupported.",
      evidenceBasis,
      effort: "hours",
      risk: "low",
    };
  }

  if (lens === "smallest-test") {
    const policy = PHASE_OPERATING_PLANS[context.phase];
    return {
      title: "Define the next test as a decision threshold",
      action: `State the smallest test for the ${context.phase} phase as an observation with a pass, revise, and stop condition, so its result can be recorded as evidence. The phase objective is: ${truncate(policy.objective, 400)}`,
      rationale:
        "A test written as a decision threshold produces a recordable result; a test written as an activity does not.",
      expectedOutcome:
        "One test is written so that running it changes a specific decision in the record.",
      evidenceBasis,
      effort: "hours",
      risk: "low",
    };
  }

  if (lens === "system-risk") {
    const risk = facts.decisionsWithoutArtifacts.length > 0
      ? `${facts.decisionsWithoutArtifacts.length} recorded ${facts.decisionsWithoutArtifacts.length === 1 ? "decision has" : "decisions have"} no linked artifact, so what implements them is untracked.`
      : "The record does not yet expose the dependency most likely to invalidate the direction.";
    return {
      title: "Name the dependency that would invalidate the direction",
      action: `Write down the single dependency, interface, or assumption whose failure would most damage this project, and how it would be detected. ${risk}`,
      rationale:
        "A failure path that is not written down cannot be monitored, tested, or handed off.",
      expectedOutcome:
        "The project record names one concrete failure path and its detection signal.",
      evidenceBasis,
      effort: "hours",
      risk: "moderate",
    };
  }

  return {
    title: "Produce one reviewable artifact for this phase",
    action: `Turn the current record into one bounded artifact that another person could review without additional explanation, and link it to the decisions it implements. The phase handoff is: ${truncate(PHASE_OPERATING_PLANS[context.phase].handoff, 400)}`,
    rationale:
      "A reviewable artifact converts accumulated context into something a phase gate decision can be taken against.",
    expectedOutcome:
      "One artifact exists in the record with its decisions and evidence linked.",
    evidenceBasis,
    effort: "days",
    risk: "moderate",
  };
}

function localChallenge(
  move: CouncilMove,
  context: CouncilProjectContext,
  facts: RecordFacts,
): CouncilChallenge {
  const knownEvidence = new Set(context.evidence.map(({ id }) => id));
  const invalidCitations = move.evidenceBasis.evidenceIds.filter(
    (id) => !knownEvidence.has(id),
  );
  const unsupportedClaims: string[] = [];

  if (invalidCitations.length > 0) {
    unsupportedClaims.push(
      `${invalidCitations.length} cited evidence ${invalidCitations.length === 1 ? "identifier does" : "identifiers do"} not exist in the project record.`,
    );
  }
  if (move.evidenceBasis.unsupported) {
    unsupportedClaims.push(
      "The move proceeds without any recorded evidence to rest on.",
    );
  }
  if (facts.evidenceCount === 0 && facts.decisionCount > 0) {
    unsupportedClaims.push(
      "Decisions in the record have no evidence behind them, so any outcome claim is unverifiable.",
    );
  }

  const verdict =
    invalidCitations.length > 0
      ? "refuted"
      : unsupportedClaims.length > 0
        ? "qualified"
        : "upheld";

  return {
    verdict,
    grounds:
      verdict === "refuted"
        ? "The move cites project entries that are absent from the record, so its basis cannot be verified."
        : verdict === "qualified"
          ? "The move is structurally sound but rests on support the record does not yet contain."
          : "The move cites entries that exist in the record and states an outcome the record can hold.",
    unsupportedClaims: unsupportedClaims.slice(0, 6),
    smallerAlternative:
      verdict === "upheld"
        ? ""
        : "Record the supporting evidence first, then take this move in its stated form.",
  };
}

function localSynthesis(
  deliberations: readonly CouncilDeliberation[],
  context: CouncilProjectContext,
  facts: RecordFacts,
): CouncilSynthesis {
  const policy = PHASE_OPERATING_PLANS[context.phase];
  const ranked = [...deliberations]
    .sort((left, right) => {
      const order = { upheld: 0, qualified: 1, refuted: 2 } as const;
      return (
        order[left.challenge.verdict] - order[right.challenge.verdict] ||
        left.lens.localeCompare(right.lens)
      );
    })
    .map((item) => item.move.title);

  const satisfiedCriteria: string[] = [];
  const missingCriteria: string[] = [];

  if (facts.evidenceCount > 0) {
    satisfiedCriteria.push("The record holds at least one evidence entry.");
  } else {
    missingCriteria.push(
      "No evidence is recorded for this phase, so its acceptance criteria cannot be checked.",
    );
  }

  if (facts.acceptedDecisionCount > 0) {
    satisfiedCriteria.push("At least one decision has been accepted.");
  } else {
    missingCriteria.push("No decision has been accepted at this phase.");
  }

  if (facts.artifactCount > 0) {
    satisfiedCriteria.push("The project graph holds a reviewable artifact.");
  } else {
    missingCriteria.push("No artifact exists for a reviewer to assess.");
  }

  for (const criterion of policy.acceptanceCriteria.slice(0, 2)) {
    missingCriteria.push(
      `Not checkable locally: ${truncate(criterion, 340)}`,
    );
  }

  const assessment =
    facts.evidenceCount === 0
      ? "not-ready"
      : missingCriteria.length > 2
        ? "evidence-incomplete"
        : "evidence-incomplete";

  return {
    summary: truncate(
      `This is a deterministic local reading of the ${context.phase} phase record. It ranks ${deliberations.length} proposed ${deliberations.length === 1 ? "move" : "moves"} by whether the record supports them. It does not replace a provider review, and it cannot judge the substance of the work.`,
      1_600,
    ),
    rankedMoveTitles: ranked.length > 0 ? ranked.slice(0, 6) : ["Record the first evidence entry"],
    sequenceRationale:
      "Moves whose citations exist in the record are ordered first, then those that need supporting evidence recorded before they can be taken.",
    unresolvedConflicts: [
      "A local reading checks record structure only. Whether the evidence is adequate remains an open question for a person or a provider review.",
    ],
    gateReadiness: {
      assessment,
      rationale:
        "This assessment reflects what the project record structurally contains, not the quality of the work. Only a person can record a phase gate decision.",
      satisfiedCriteria: satisfiedCriteria.slice(0, 6),
      missingCriteria: missingCriteria.slice(0, 6),
    },
  };
}

export function executeLocalCouncilSession(
  request: CouncilSessionRequest,
  options: Readonly<{ sessionId: string; inputDigest: string; now?: () => Date }>,
): CouncilSessionResult {
  const now = options.now ?? (() => new Date());
  const context = request.projectContext;
  const facts = readRecord(context);
  const survey = localSurvey(context, facts);

  const deliberations: CouncilDeliberation[] = request.lenses.map((lens) => {
    const move = localMove(lens, context, facts);
    const challenge = localChallenge(move, context, facts);
    return {
      id: `${options.sessionId}:${lens}`,
      lens,
      move,
      challenge,
      survivesChallenge: challenge.verdict !== "refuted",
    };
  });

  return {
    sessionId: options.sessionId,
    protocolVersion: COUNCIL_PROTOCOL_VERSION,
    phase: context.phase,
    source: "local",
    model: "kingxford-local-council",
    survey,
    deliberations,
    synthesis: localSynthesis(deliberations, context, facts),
    boundaries: [
      ...COUNCIL_BOUNDARIES,
      "This session ran locally without a model provider. It reads record structure only.",
    ],
    inputDigest: options.inputDigest,
    completedAt: now().toISOString(),
    usage: { inputTokens: 0, outputTokens: 0, providerCalls: 0 },
  };
}

export function councilSessionId(seed: string, salt: string) {
  return `council_${createHash("sha256")
    .update(`${salt}:${seed}`)
    .digest("hex")
    .slice(0, 32)}`;
}

export function councilLensLabel(lens: CouncilLens) {
  return councilLensLabels[lens];
}
