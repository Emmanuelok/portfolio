import { z } from "zod";

import {
  platformAgentRoles,
  platformArtifactRelations,
  platformDecisionStatuses,
  platformEvidenceKinds,
  platformPhases,
} from "@/lib/platform/types";
import { projectSnapshotSchema } from "@/lib/workspace/project-snapshot-schema";
import { workspaceModes } from "@/lib/workspace/types";

export const INTELLIGENCE_PROTOCOL_VERSION = "kx-intelligence-2026-08-05.2";

export const intelligenceSpecialistRoles = [
  "discovery",
  "evidence",
  "systems",
  "prototype",
  "validation",
  "delivery",
] as const;

export const intelligenceCapabilities = [
  "structured-review",
  "phase-planning",
  "parallel-specialists",
  "project-context",
  "artifact-provenance",
  "external-research",
  "code-execution",
  "autonomous-deployment",
] as const;

export const supportedIntelligenceCapabilities = [
  "structured-review",
  "phase-planning",
  "parallel-specialists",
  "project-context",
  "artifact-provenance",
] as const;

const identifierSchema = z
  .string()
  .min(1)
  .max(180)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const projectHashSchema = z.string().regex(/^kxhash_[a-f0-9]{32}$/);
const timestampSchema = z.string().datetime({ offset: true });
const shortTextSchema = z.string().min(1).max(4_000);
const boundedTextSchema = z.string().max(48_000);

export const intelligenceProjectBindingSchema = z
  .object({
    projectId: identifierSchema,
    snapshotId: identifierSchema,
    snapshotHash: projectHashSchema,
    snapshotSchemaVersion: z.number().int().positive(),
    snapshotCharacterCount: z.number().int().min(0).max(64_000),
    artifactRevisionId: identifierSchema,
    artifactId: identifierSchema,
    draftHash: projectHashSchema,
    counts: z
      .object({
        nodes: z.number().int().min(0),
        edges: z.number().int().min(0),
        artifacts: z.number().int().min(0),
        revisions: z.number().int().min(0),
        reviews: z.number().int().min(0),
        decisions: z.number().int().min(0),
        gates: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export const intelligenceCodeSchema = z
  .object({
    html: z.string().max(16_000),
    css: z.string().max(16_000),
    javascript: z.string().max(16_000),
  })
  .strict();

export const intelligenceReviewSchema = z
  .object({
    summary: z.string().min(1).max(1_600),
    status: z.enum(["Strong", "Developing", "Unresolved"]),
    strengths: z.array(z.string().min(1).max(500)).min(1).max(6),
    uncertainties: z.array(z.string().min(1).max(500)).min(1).max(6),
    failurePoints: z.array(z.string().min(1).max(500)).min(1).max(6),
    assumptions: z.array(z.string().min(1).max(500)).min(1).max(6),
    nextTest: z.string().min(1).max(1_200),
    proposedChanges: z.array(z.string().min(1).max(600)).min(1).max(8),
    improvedInput: z.string().min(1).max(20_000),
    improvedCode: intelligenceCodeSchema.nullable(),
    buildBrief: z
      .object({
        title: z.string().min(1).max(160),
        oneLine: z.string().min(1).max(700),
        audience: z.string().min(1).max(700),
        coreExperience: z.string().min(1).max(900),
        deliverables: z.array(z.string().min(1).max(300)).min(2).max(8),
        complexity: z.enum(["Focused", "Layered", "Advanced"]),
      })
      .strict(),
  })
  .strict();

const evidenceSchema = z
  .object({
    id: identifierSchema,
    kind: z.enum(platformEvidenceKinds),
    title: z.string().min(1).max(180),
    source: z.string().max(2_000),
    claim: z.string().max(2_000),
    addedAt: timestampSchema,
  })
  .strict();

const decisionSchema = z
  .object({
    id: identifierSchema,
    title: z.string().min(1).max(180),
    decision: z.string().max(2_000),
    rationale: z.string().max(2_000),
    status: z.enum(platformDecisionStatuses),
    relatedArtifactIds: z.array(identifierSchema).max(16),
    createdAt: timestampSchema,
  })
  .strict();

const acceptedRunSchema = z
  .object({
    id: identifierSchema,
    role: z.enum(platformAgentRoles),
    phase: z.enum(platformPhases),
    source: z.enum(["openai", "local"]),
    model: z.string().min(1).max(200),
    protocolVersion: z.string().min(1).max(200),
    inputDigest: digestSchema,
    summary: z.string().min(1).max(1_600),
    artifactIds: z.array(identifierSchema).max(16),
    acceptedAt: timestampSchema,
  })
  .strict();

const contextArtifactSchema = z
  .object({
    id: identifierSchema,
    title: z.string().min(1).max(180),
    kind: z.enum([
      "workspace-source",
      "version",
      "evidence",
      "decision",
      "agent-output",
      "handoff",
    ]),
    summary: z.string().max(1_600),
    digest: digestSchema.optional(),
    createdAt: timestampSchema,
  })
  .strict();

export const intelligenceRunRequestSchema = z
  .object({
    mode: z.enum(workspaceModes),
    title: z.string().max(120),
    text: z.string().max(22_000),
    code: intelligenceCodeSchema,
    objective: z.string().min(1).max(600),
    depth: z.enum(["standard", "deep"]),
    projectContext: z
      .object({
        projectId: identifierSchema,
        objective: z.string().max(600),
        phase: z.enum(platformPhases),
        evidence: z.array(evidenceSchema).max(24),
        decisions: z.array(decisionSchema).max(24),
        acceptedRuns: z.array(acceptedRunSchema).max(24),
        artifacts: z.array(contextArtifactSchema).max(32),
        artifactRelationships: z
          .array(
            z
              .object({
                id: identifierSchema,
                fromArtifactId: identifierSchema,
                toArtifactId: identifierSchema,
                relation: z.enum(platformArtifactRelations),
                label: z.string().max(300),
                createdAt: timestampSchema,
              })
              .strict(),
          )
          .max(48)
          .default([]),
      })
      .strict(),
    context: z
      .object({
        codeLogs: z.array(z.string().max(1_000)).max(12),
        versions: z
          .array(
            z
              .object({
                id: identifierSchema.optional(),
                name: z.string().max(120),
                mode: z.enum(workspaceModes),
                text: z.string().max(1_800),
              })
              .strict(),
          )
          .max(3),
      })
      .strict(),
    orchestration: z
      .object({
        maxSpecialistPasses: z.number().int().min(0).max(2).default(2),
        requestedRoles: z.array(z.enum(intelligenceSpecialistRoles)).max(2).default([]),
      })
      .strict(),
    capabilityNegotiation: z
      .object({
        requested: z
          .array(z.enum(intelligenceCapabilities))
          .min(1)
          .max(intelligenceCapabilities.length),
      })
      .strict(),
    projectGraphSnapshot: projectSnapshotSchema,
    artifactRevisionId: identifierSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const workspaceCharacters =
      value.text.length +
      value.code.html.length +
      value.code.css.length +
      value.code.javascript.length +
      value.objective.length +
      value.projectContext.objective.length +
      value.projectContext.evidence.reduce(
        (sum, item) => sum + item.title.length + item.source.length + item.claim.length,
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
      ) +
      value.context.codeLogs.join("").length +
      value.context.versions.reduce((sum, item) => sum + item.text.length, 0);

    if (workspaceCharacters > 64_000) {
      context.addIssue({
        code: "custom",
        message: "Selected project intelligence exceeds the 64,000-character run limit.",
      });
    }

    if (value.projectContext.phase === "discovery" && value.orchestration.requestedRoles.includes("delivery")) {
      context.addIssue({
        code: "custom",
        path: ["orchestration", "requestedRoles"],
        message: "Delivery cannot replace discovery work during the Discover phase.",
      });
    }

    if (
      value.projectGraphSnapshot.project.id !== value.projectContext.projectId
    ) {
      context.addIssue({
        code: "custom",
        path: ["projectGraphSnapshot", "project", "id"],
        message: "The project graph snapshot must match the active project context.",
      });
    }
    if (
      value.projectGraphSnapshot.project.activePhase !== value.projectContext.phase
    ) {
      context.addIssue({
        code: "custom",
        path: ["projectGraphSnapshot", "project", "activePhase"],
        message: "The project graph snapshot must match the active lifecycle phase.",
      });
    }
  });

export const intelligenceCapabilityResultSchema = z
  .object({
    requested: z.array(z.enum(intelligenceCapabilities)),
    granted: z.array(z.enum(intelligenceCapabilities)),
    declined: z.array(
      z
        .object({
          capability: z.enum(intelligenceCapabilities),
          reason: z.string().min(1).max(400),
        })
        .strict(),
    ),
  })
  .strict();

const planSpecialistSchema = z
  .object({
    role: z.enum(intelligenceSpecialistRoles),
    mandate: z.string().min(1).max(800),
    expectedContribution: z.string().min(1).max(800),
  })
  .strict();

export const intelligencePlanSchema = z
  .object({
    phase: z.enum(platformPhases),
    summary: z.string().min(1).max(1_200),
    phaseObjective: z.string().min(1).max(1_200),
    specialists: z.array(planSpecialistSchema).max(2),
    sequence: z.array(z.string().min(1).max(500)).min(1).max(6),
    acceptanceCriteria: z.array(z.string().min(1).max(500)).min(1).max(6),
    conflicts: z.array(z.string().min(1).max(500)).max(6),
    boundaries: z.array(z.string().min(1).max(500)).min(1).max(6),
    handoff: z.string().min(1).max(800),
  })
  .strict();

export const intelligenceArtifactSchema = z
  .object({
    id: identifierSchema,
    kind: z.enum(["conductor-plan", "specialist-review", "synthesis"]),
    title: z.string().min(1).max(180),
    phase: z.enum(platformPhases),
    role: z.enum(platformAgentRoles),
    digest: digestSchema,
    parentArtifactIds: z.array(identifierSchema).max(48),
    createdAt: timestampSchema,
  })
  .strict();

export const intelligenceSpecialistPassSchema = z
  .object({
    id: identifierSchema,
    role: z.enum(intelligenceSpecialistRoles),
    status: z.enum(["completed", "failed", "skipped"]),
    source: z.enum(["openai", "local"]),
    model: z.string().min(1).max(200),
    review: intelligenceReviewSchema.nullable(),
    inputDigest: digestSchema,
    outputDigest: digestSchema.nullable(),
    artifactId: identifierSchema.nullable(),
    notice: z.string().max(800).optional(),
  })
  .strict();

export const intelligenceProviderCallSchema = z
  .object({
    id: identifierSchema,
    stage: z.enum(["plan", "specialist", "synthesis"]),
    role: z.enum(platformAgentRoles),
    model: z.string().min(1).max(200),
    status: z.enum(["completed", "failed", "cancelled", "timed-out"]),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    latencyMs: z.number().int().min(0).max(120_000),
    inputDigest: digestSchema,
    outputDigest: digestSchema.nullable(),
    usage: z
      .object({
        inputTokens: z.number().int().min(0),
        outputTokens: z.number().int().min(0),
        totalTokens: z.number().int().min(0),
      })
      .strict(),
    failureCode: z
      .enum([
        "attempt-timeout",
        "client-aborted",
        "invalid-output",
        "auth-rejected",
        "budget-exhausted",
        "rate-limited",
        "request-rejected",
        "provider-unavailable",
        "unknown-failure",
      ])
      .optional(),
  })
  .strict();

export const intelligenceRunResponseSchema = z
  .object({
    runId: identifierSchema,
    status: z.enum(["completed", "partial", "local-fallback"]),
    review: intelligenceReviewSchema,
    source: z.enum(["openai", "local"]),
    model: z.string().min(1).max(200),
    phase: z.enum(platformPhases),
    agentRole: z.literal("conductor"),
    protocolVersion: z.literal(INTELLIGENCE_PROTOCOL_VERSION),
    inputDigest: digestSchema,
    orchestration: z
      .object({
        plan: intelligencePlanSchema,
        passes: z.array(intelligenceSpecialistPassSchema).max(2),
      })
      .strict(),
    capabilityNegotiation: intelligenceCapabilityResultSchema,
    artifacts: z.array(intelligenceArtifactSchema).min(2).max(4),
    provenance: z
      .object({
        providerCalls: z.array(intelligenceProviderCallSchema).max(4),
        parentArtifactIds: z.array(identifierSchema).max(32),
        finalArtifactId: identifierSchema,
        usage: z
          .object({
            inputTokens: z.number().int().min(0),
            outputTokens: z.number().int().min(0),
            totalTokens: z.number().int().min(0),
          })
          .strict(),
      })
      .strict(),
    startedAt: timestampSchema,
    completedAt: timestampSchema,
    projectContext: intelligenceProjectBindingSchema,
    notice: z.string().max(1_600).optional(),
  })
  .strict();

export type IntelligenceRunRequest = z.infer<typeof intelligenceRunRequestSchema>;
export type IntelligenceRunResponse = z.infer<typeof intelligenceRunResponseSchema>;
export type IntelligenceReview = z.infer<typeof intelligenceReviewSchema>;
export type IntelligencePlan = z.infer<typeof intelligencePlanSchema>;
export type IntelligenceSpecialistRole = (typeof intelligenceSpecialistRoles)[number];
export type IntelligenceCapability = (typeof intelligenceCapabilities)[number];

export const intelligencePromptOutputSchema = z
  .object({
    summary: shortTextSchema,
    phaseObjective: shortTextSchema,
    sequence: z.array(shortTextSchema).min(1).max(6),
    acceptanceCriteria: z.array(shortTextSchema).min(1).max(6),
    conflicts: z.array(shortTextSchema).max(6),
    boundaries: z.array(shortTextSchema).min(1).max(6),
    handoff: shortTextSchema,
  })
  .strict();

// Retained as exported building blocks for downstream typed artifact adapters.
export const intelligenceBoundedTextSchema = boundedTextSchema;
export const intelligenceDigestSchema = digestSchema;
