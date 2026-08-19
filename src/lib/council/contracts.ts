import { z } from "zod";

import {
  intelligenceProjectContextSchema,
  type IntelligenceProjectContext,
} from "@/lib/intelligence/contracts";
import { platformPhases } from "@/lib/platform/types";
import { projectSnapshotSchema } from "@/lib/workspace/project-snapshot-schema";

export const COUNCIL_PROTOCOL_VERSION = "kx-council-2026-08-18.1";

export const councilLenses = [
  "evidence-gap",
  "smallest-test",
  "system-risk",
  "delivery-path",
] as const;

export type CouncilLens = (typeof councilLenses)[number];

export const councilLensLabels: Readonly<Record<CouncilLens, string>> = {
  "evidence-gap": "Evidence gap",
  "smallest-test": "Smallest test",
  "system-risk": "System risk",
  "delivery-path": "Delivery path",
};

export const councilLensMandates: Readonly<Record<CouncilLens, string>> = {
  "evidence-gap":
    "Identify what must be known before the next step is defensible, and the single move that would close the most decision-blocking gap in the project record.",
  "smallest-test":
    "Propose the smallest responsible test that would change a decision, stated so its result can be observed and recorded as evidence.",
  "system-risk":
    "Name the structural, dependency, or failure-path risk most likely to invalidate the current direction, and the move that would expose or reduce it.",
  "delivery-path":
    "Propose the bounded piece of work that would turn the current record into a reviewable artifact, without implying it has been built or released.",
};

const identifierSchema = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const timestampSchema = z.string().datetime({ offset: true });

/**
 * Every recommendation must either cite project-record evidence by id or state
 * that the record contains none. The council may not imply unrecorded support.
 */
export const councilEvidenceBasisSchema = z
  .object({
    evidenceIds: z.array(identifierSchema).max(8),
    decisionIds: z.array(identifierSchema).max(8),
    unsupported: z.boolean(),
    note: z.string().min(1).max(600),
  })
  .strict();

export const councilSurveySchema = z
  .object({
    positionSummary: z.string().min(1).max(1_400),
    established: z.array(z.string().min(1).max(400)).max(6),
    assumed: z.array(z.string().min(1).max(400)).max(6),
    missing: z.array(z.string().min(1).max(400)).max(6),
    contested: z.array(z.string().min(1).max(400)).max(4),
  })
  .strict();

export const councilMoveSchema = z
  .object({
    title: z.string().min(1).max(160),
    action: z.string().min(1).max(900),
    rationale: z.string().min(1).max(900),
    expectedOutcome: z.string().min(1).max(600),
    evidenceBasis: councilEvidenceBasisSchema,
    effort: z.enum(["hours", "days", "weeks"]),
    risk: z.enum(["low", "moderate", "high"]),
  })
  .strict();

export const councilChallengeSchema = z
  .object({
    verdict: z.enum(["upheld", "qualified", "refuted"]),
    grounds: z.string().min(1).max(900),
    unsupportedClaims: z.array(z.string().min(1).max(400)).max(6),
    smallerAlternative: z.string().max(600),
  })
  .strict();

export const councilGateReadinessSchema = z
  .object({
    assessment: z.enum([
      "not-ready",
      "evidence-incomplete",
      "ready-for-human-decision",
    ]),
    rationale: z.string().min(1).max(900),
    satisfiedCriteria: z.array(z.string().min(1).max(400)).max(6),
    missingCriteria: z.array(z.string().min(1).max(400)).max(6),
  })
  .strict();

export const councilSynthesisSchema = z
  .object({
    summary: z.string().min(1).max(1_600),
    rankedMoveTitles: z.array(z.string().min(1).max(160)).min(1).max(6),
    sequenceRationale: z.string().min(1).max(900),
    unresolvedConflicts: z.array(z.string().min(1).max(400)).max(6),
    gateReadiness: councilGateReadinessSchema,
  })
  .strict();

export const councilSessionRequestSchema = z
  .object({
    objective: z.string().min(1).max(600),
    depth: z.enum(["standard", "deep"]),
    projectContext: intelligenceProjectContextSchema,
    projectGraphSnapshot: projectSnapshotSchema,
    lenses: z.array(z.enum(councilLenses)).min(1).max(4),
  })
  .strict()
  .superRefine((value, context) => {
    const characters =
      value.objective.length +
      value.projectContext.objective.length +
      value.projectContext.evidence.reduce(
        (sum, item) =>
          sum + item.title.length + item.source.length + item.claim.length,
        0,
      ) +
      value.projectContext.decisions.reduce(
        (sum, item) =>
          sum + item.title.length + item.decision.length + item.rationale.length,
        0,
      ) +
      value.projectContext.artifacts.reduce(
        (sum, item) => sum + item.title.length + item.summary.length,
        0,
      );

    if (characters > 48_000) {
      context.addIssue({
        code: "custom",
        message:
          "Selected project material exceeds the 48,000-character council limit.",
      });
    }

    if (
      value.projectGraphSnapshot.project.id !== value.projectContext.projectId
    ) {
      context.addIssue({
        code: "custom",
        path: ["projectGraphSnapshot", "project", "id"],
        message:
          "The project graph snapshot must match the active project context.",
      });
    }

    if (
      value.projectGraphSnapshot.project.activePhase !==
      value.projectContext.phase
    ) {
      context.addIssue({
        code: "custom",
        path: ["projectGraphSnapshot", "project", "activePhase"],
        message:
          "The project graph snapshot must match the active lifecycle phase.",
      });
    }
  });

export const councilDeliberationSchema = z
  .object({
    id: identifierSchema,
    lens: z.enum(councilLenses),
    move: councilMoveSchema,
    challenge: councilChallengeSchema,
    survivesChallenge: z.boolean(),
  })
  .strict();

export const councilSessionResultSchema = z
  .object({
    sessionId: identifierSchema,
    protocolVersion: z.string().min(1).max(120),
    phase: z.enum(platformPhases),
    source: z.enum(["gateway", "local"]),
    model: z.string().min(1).max(200),
    survey: councilSurveySchema,
    deliberations: z.array(councilDeliberationSchema).min(1).max(4),
    synthesis: councilSynthesisSchema,
    boundaries: z.array(z.string().min(1).max(400)).min(1).max(8),
    inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
    completedAt: timestampSchema,
    usage: z
      .object({
        inputTokens: z.number().int().min(0),
        outputTokens: z.number().int().min(0),
        providerCalls: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export const councilStageEventSchema = z.discriminatedUnion("stage", [
  z
    .object({
      stage: z.literal("accepted"),
      sessionId: identifierSchema,
      phase: z.enum(platformPhases),
      lenses: z.array(z.enum(councilLenses)).min(1).max(4),
      source: z.enum(["gateway", "local"]),
    })
    .strict(),
  z
    .object({
      stage: z.literal("survey"),
      survey: councilSurveySchema,
    })
    .strict(),
  z
    .object({
      stage: z.literal("proposal"),
      id: identifierSchema,
      lens: z.enum(councilLenses),
      move: councilMoveSchema,
    })
    .strict(),
  z
    .object({
      stage: z.literal("challenge"),
      id: identifierSchema,
      lens: z.enum(councilLenses),
      challenge: councilChallengeSchema,
      survivesChallenge: z.boolean(),
    })
    .strict(),
  z
    .object({
      stage: z.literal("complete"),
      result: councilSessionResultSchema,
    })
    .strict(),
  z
    .object({
      stage: z.literal("failed"),
      code: z.enum([
        "rate-limited",
        "daily-limit-reached",
        "usage-service-unavailable",
        "council-failed",
        "cancelled",
      ]),
      message: z.string().min(1).max(400),
      retryAfter: z.number().int().positive().max(86_400).optional(),
    })
    .strict(),
]);

export type CouncilSessionRequest = z.infer<typeof councilSessionRequestSchema>;
export type CouncilSurvey = z.infer<typeof councilSurveySchema>;
export type CouncilMove = z.infer<typeof councilMoveSchema>;
export type CouncilChallenge = z.infer<typeof councilChallengeSchema>;
export type CouncilSynthesis = z.infer<typeof councilSynthesisSchema>;
export type CouncilDeliberation = z.infer<typeof councilDeliberationSchema>;
export type CouncilSessionResult = z.infer<typeof councilSessionResultSchema>;
export type CouncilStageEvent = z.infer<typeof councilStageEventSchema>;
export type CouncilProjectContext = IntelligenceProjectContext;

export const COUNCIL_BOUNDARIES: readonly string[] = [
  "The council proposes moves only. It cannot apply a revision, publish work, or approve a phase gate.",
  "Gate readiness is an assessment of the record, not a decision. Only a person can record a gate decision.",
  "No browsing, code execution, deployment, messaging, or other external action occurred.",
  "Recommendations cite project-record evidence by identifier, or state that the record contains none.",
];
