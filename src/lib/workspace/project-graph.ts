import { z } from "zod";

import type { CodeFiles } from "./types";

export const KINGXFORD_PROJECT_SCHEMA = "kingxford-project" as const;
export const KINGXFORD_PROJECT_SCHEMA_VERSION = 2 as const;

export const projectPhases = [
  "discovery",
  "evidence",
  "systems",
  "prototype",
  "validation",
  "delivery",
] as const;

export type ProjectPhase = (typeof projectPhases)[number];

export const artifactKinds = [
  "idea",
  "evidence",
  "system-map",
  "prompt",
  "code",
  "brief",
] as const;

export type ArtifactKind = (typeof artifactKinds)[number];

export const revisionSources = [
  "human",
  "local-transform",
  "agent-proposal",
  "agent-accepted",
  "restored",
  "canvas-v1-migration",
] as const;

export type RevisionSource = (typeof revisionSources)[number];

export const projectNodeKinds = [
  "phase",
  "artifact",
  "revision",
  "review",
  "decision",
  "gate",
  "problem",
  "stakeholder",
  "outcome",
  "constraint",
  "question",
  "assumption",
  "evidence",
  "risk",
  "test",
  "deliverable",
] as const;

export type ProjectNodeKind = (typeof projectNodeKinds)[number];

export const semanticProjectNodeKinds = [
  "problem",
  "stakeholder",
  "outcome",
  "constraint",
  "question",
  "assumption",
  "evidence",
  "risk",
  "test",
  "deliverable",
] as const;

export type SemanticProjectNodeKind = (typeof semanticProjectNodeKinds)[number];

export const projectNodeStatuses = [
  "known",
  "unresolved",
  "testing",
  "validated",
  "blocked",
] as const;

export type ProjectNodeStatus = (typeof projectNodeStatuses)[number];

export const projectEdgeTypes = [
  "contains",
  "materializes",
  "revises",
  "derives-from",
  "depends-on",
  "supports",
  "reviews",
  "decides",
  "governs",
  "informs",
] as const;

export type ProjectEdgeType = (typeof projectEdgeTypes)[number];

export const PROJECT_GRAPH_LIMITS = Object.freeze({
  titleCharacters: 160,
  summaryCharacters: 1200,
  artifactCount: 48,
  revisionCount: 144,
  revisionsPerArtifact: 24,
  nodeCount: 320,
  edgeCount: 640,
  reviewLinkCount: 72,
  decisionCount: 36,
  gateCount: 12,
  revisionTextCharacters: 60_000,
  codeFileCharacters: 80_000,
});

const entityIdSchema = z
  .string()
  .regex(/^kx_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}$/);
const hashSchema = z.string().regex(/^kxhash_[0-9a-f]{32}$/);
const isoDateSchema = z.string().datetime({ offset: true });
const nonBlankSchema = (maximum: number) =>
  z.string().min(1).max(maximum).refine((value) => value.trim().length > 0);

const revisionBodySchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("text"),
      text: z.string().max(PROJECT_GRAPH_LIMITS.revisionTextCharacters),
    })
    .strict(),
  z
    .object({
      type: z.literal("code"),
      html: z.string().max(PROJECT_GRAPH_LIMITS.codeFileCharacters),
      css: z.string().max(PROJECT_GRAPH_LIMITS.codeFileCharacters),
      javascript: z.string().max(PROJECT_GRAPH_LIMITS.codeFileCharacters),
    })
    .strict(),
]);

export type ProjectRevisionBody = z.infer<typeof revisionBodySchema>;

export const projectRevisionSchema = z
  .object({
    id: entityIdSchema,
    artifactId: entityIdSchema,
    parentRevisionId: entityIdSchema.nullable(),
    createdAt: isoDateSchema,
    source: z.enum(revisionSources),
    contentHash: hashSchema,
    body: revisionBodySchema,
  })
  .strict();

export type ProjectRevision = z.infer<typeof projectRevisionSchema>;

export const projectArtifactSchema = z
  .object({
    id: entityIdSchema,
    kind: z.enum(artifactKinds),
    title: nonBlankSchema(160),
    phase: z.enum(projectPhases),
    activeRevisionId: entityIdSchema,
    revisionIds: z
      .array(entityIdSchema)
      .min(1)
      .max(PROJECT_GRAPH_LIMITS.revisionsPerArtifact),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export type ProjectArtifact = z.infer<typeof projectArtifactSchema>;

export const projectNodeSchema = z
  .object({
    id: entityIdSchema,
    kind: z.enum(projectNodeKinds),
    refId: z.string().min(1).max(120),
    phase: z.enum(projectPhases),
    label: nonBlankSchema(180),
    status: z.enum(projectNodeStatuses),
    statement: z.string().max(1200),
    sourceRef: z.string().max(320).nullable(),
    createdAt: isoDateSchema,
  })
  .strict();

export type ProjectNode = z.infer<typeof projectNodeSchema>;

export const projectEdgeSchema = z
  .object({
    id: entityIdSchema,
    type: z.enum(projectEdgeTypes),
    fromNodeId: entityIdSchema,
    toNodeId: entityIdSchema,
    createdAt: isoDateSchema,
  })
  .strict();

export type ProjectEdge = z.infer<typeof projectEdgeSchema>;

export const projectReviewLinkSchema = z
  .object({
    id: entityIdSchema,
    phase: z.enum(projectPhases),
    artifactId: entityIdSchema,
    revisionId: entityIdSchema,
    revisionHash: hashSchema,
    requestId: z.string().min(1).max(160),
    snapshotId: entityIdSchema,
    snapshotHash: hashSchema,
    contextHash: hashSchema,
    createdAt: isoDateSchema,
  })
  .strict();

export type ProjectReviewLink = z.infer<typeof projectReviewLinkSchema>;

export const projectDecisionSchema = z
  .object({
    id: entityIdSchema,
    phase: z.enum(projectPhases),
    gateId: entityIdSchema,
    outcome: z.enum(["approved", "rejected"]),
    rationale: nonBlankSchema(1600),
    evidenceArtifactIds: z.array(entityIdSchema).min(1).max(12),
    provenance: z
      .object({
        kind: z.literal("human-confirmation"),
        actorId: nonBlankSchema(160),
        recordedAt: isoDateSchema,
      })
      .strict(),
  })
  .strict();

export type ProjectDecision = z.infer<typeof projectDecisionSchema>;

export const projectGateSchema = z
  .object({
    id: entityIdSchema,
    phase: z.enum(projectPhases),
    title: nonBlankSchema(180),
    status: z.enum(["open", "approved", "rejected"]),
    approvalMode: z.literal("human-only"),
    decisionId: entityIdSchema.nullable(),
    supportedEvidenceArtifactIds: z.array(entityIdSchema).max(12),
    createdAt: isoDateSchema,
    decidedAt: isoDateSchema.nullable(),
  })
  .strict();

export type ProjectGate = z.infer<typeof projectGateSchema>;

export const projectOriginSchema = z
  .object({
    kind: z.enum(["created", "canvas-v1-migration", "import-clone"]),
    sourceProjectId: entityIdSchema.nullable(),
    sourceSnapshotIds: z.array(entityIdSchema).max(72),
    recordedAt: isoDateSchema,
  })
  .strict();

export type ProjectOrigin = z.infer<typeof projectOriginSchema>;

export const kingxfordProjectSchema = z
  .object({
    schema: z.literal(KINGXFORD_PROJECT_SCHEMA),
    schemaVersion: z.literal(KINGXFORD_PROJECT_SCHEMA_VERSION),
    id: entityIdSchema,
    title: nonBlankSchema(PROJECT_GRAPH_LIMITS.titleCharacters),
    summary: z.string().max(PROJECT_GRAPH_LIMITS.summaryCharacters),
    activePhase: z.enum(projectPhases),
    activeArtifactId: entityIdSchema.nullable(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
    origin: projectOriginSchema,
    artifacts: z.array(projectArtifactSchema).max(PROJECT_GRAPH_LIMITS.artifactCount),
    revisions: z.array(projectRevisionSchema).max(PROJECT_GRAPH_LIMITS.revisionCount),
    nodes: z.array(projectNodeSchema).max(PROJECT_GRAPH_LIMITS.nodeCount),
    edges: z.array(projectEdgeSchema).max(PROJECT_GRAPH_LIMITS.edgeCount),
    reviewLinks: z
      .array(projectReviewLinkSchema)
      .max(PROJECT_GRAPH_LIMITS.reviewLinkCount),
    decisions: z.array(projectDecisionSchema).max(PROJECT_GRAPH_LIMITS.decisionCount),
    gates: z.array(projectGateSchema).max(PROJECT_GRAPH_LIMITS.gateCount),
  })
  .strict();

export type KingxfordProject = z.infer<typeof kingxfordProjectSchema>;

export class ProjectIntegrityError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid Kingxford project: ${issues.join("; ")}`);
    this.name = "ProjectIntegrityError";
    this.issues = issues;
  }
}

function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Stable values must be finite.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError(`Unsupported stable value: ${typeof value}`);
}

function fnv32(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= code >>> 8;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function stableStringify(value: unknown) {
  return canonicalize(value);
}

export function stableHash(value: unknown) {
  const input = canonicalize(value);
  const digest = [
    fnv32(input, 0x811c9dc5),
    fnv32(input, 0x9e3779b9),
    fnv32(input, 0x85ebca6b),
    fnv32(input, 0xc2b2ae35),
  ].join("");
  return `kxhash_${digest}` as const;
}

export function stableEntityId(namespace: string, ...parts: readonly unknown[]) {
  const safeNamespace = namespace
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  const normalized = /^[a-z]/.test(safeNamespace)
    ? safeNamespace
    : `entity_${safeNamespace}`.slice(0, 24);
  return `kx_${normalized}_${stableHash(parts).slice(-16)}`;
}

export function hashRevisionBody(body: ProjectRevisionBody) {
  return stableHash(body);
}

function uniqueIssues<T>(
  values: readonly T[],
  name: string,
  key: (value: T) => string,
) {
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) issues.push(`${name} contains duplicate ${id}.`);
    seen.add(id);
  }
  return issues;
}

function expectedRefKind(
  project: KingxfordProject,
  node: ProjectNode,
): boolean {
  if (node.kind === "phase") return projectPhases.includes(node.refId as ProjectPhase);
  if (node.kind === "artifact") return project.artifacts.some(({ id }) => id === node.refId);
  if (node.kind === "revision") return project.revisions.some(({ id }) => id === node.refId);
  if (node.kind === "review") return project.reviewLinks.some(({ id }) => id === node.refId);
  if (node.kind === "decision") return project.decisions.some(({ id }) => id === node.refId);
  if (node.kind === "gate") return project.gates.some(({ id }) => id === node.refId);
  return semanticProjectNodeKinds.includes(node.kind as SemanticProjectNodeKind)
    && node.refId === node.id;
}

function edgeKindIsValid(
  project: KingxfordProject,
  edge: Pick<ProjectEdge, "type" | "fromNodeId" | "toNodeId">,
) {
  const from = project.nodes.find(({ id }) => id === edge.fromNodeId);
  const to = project.nodes.find(({ id }) => id === edge.toNodeId);
  if (!from || !to || from.id === to.id) return false;
  if (edge.type === "contains") {
    return from.kind === "phase" && to.kind !== "phase" && to.kind !== "gate";
  }
  if (edge.type === "materializes") return from.kind === "artifact" && to.kind === "revision";
  if (edge.type === "revises") return from.kind === "revision" && to.kind === "revision";
  if (edge.type === "reviews") return from.kind === "review" && to.kind === "revision";
  if (edge.type === "decides") return from.kind === "decision" && to.kind === "gate";
  if (edge.type === "governs") return from.kind === "gate" && to.kind === "phase";
  if (edge.type === "supports") {
    const artifact = from.kind === "artifact"
      ? project.artifacts.find(({ id }) => id === from.refId)
      : undefined;
    return (from.kind === "evidence" || artifact?.kind === "evidence")
      && to.kind !== "phase";
  }
  return from.kind !== "phase" && to.kind !== "phase";
}

function gateIntegrityIssues(project: KingxfordProject, gate: ProjectGate) {
  const issues: string[] = [];
  if (gate.status === "open") {
    if (gate.decisionId !== null || gate.decidedAt !== null) {
      issues.push(`Open gate ${gate.id} cannot carry a decision.`);
    }
    return issues;
  }

  if (!gate.decisionId || !gate.decidedAt) {
    issues.push(`Closed gate ${gate.id} requires decision provenance.`);
    return issues;
  }

  const decision = project.decisions.find(({ id }) => id === gate.decisionId);
  if (!decision) {
    issues.push(`Gate ${gate.id} references missing decision ${gate.decisionId}.`);
    return issues;
  }
  if (decision.gateId !== gate.id || decision.phase !== gate.phase) {
    issues.push(`Decision ${decision.id} does not belong to gate ${gate.id}'s phase.`);
  }
  if (decision.outcome !== gate.status) {
    issues.push(`Decision ${decision.id} outcome disagrees with gate ${gate.id}.`);
  }
  if (decision.provenance.kind !== "human-confirmation") {
    issues.push(`Gate ${gate.id} requires explicit human provenance.`);
  }
  if (decision.provenance.recordedAt !== gate.decidedAt) {
    issues.push(`Gate ${gate.id} timestamp does not match its decision provenance.`);
  }
  if (gate.supportedEvidenceArtifactIds.length === 0) {
    issues.push(`Gate ${gate.id} requires supported evidence from the same phase.`);
  }

  const declaredEvidence = new Set(decision.evidenceArtifactIds);
  for (const artifactId of gate.supportedEvidenceArtifactIds) {
    const evidence = project.artifacts.find(({ id }) => id === artifactId);
    if (!evidence || evidence.kind !== "evidence" || evidence.phase !== gate.phase) {
      issues.push(`Gate ${gate.id} has invalid same-phase evidence ${artifactId}.`);
    }
    if (!declaredEvidence.has(artifactId)) {
      issues.push(`Gate ${gate.id} evidence ${artifactId} is absent from its decision.`);
    }
  }
  return issues;
}

export function collectProjectIntegrityIssues(project: KingxfordProject) {
  const issues = [
    ...uniqueIssues(project.artifacts, "artifacts", ({ id }) => id),
    ...uniqueIssues(project.revisions, "revisions", ({ id }) => id),
    ...uniqueIssues(project.nodes, "nodes", ({ id }) => id),
    ...uniqueIssues(project.edges, "edges", ({ id }) => id),
    ...uniqueIssues(project.reviewLinks, "reviewLinks", ({ id }) => id),
    ...uniqueIssues(project.decisions, "decisions", ({ id }) => id),
    ...uniqueIssues(project.gates, "gates", ({ id }) => id),
  ];

  if (project.updatedAt < project.createdAt) {
    issues.push("Project updatedAt precedes createdAt.");
  }
  if (
    project.activeArtifactId !== null
    && !project.artifacts.some(({ id }) => id === project.activeArtifactId)
  ) {
    issues.push(`Active artifact ${project.activeArtifactId} does not exist.`);
  }

  const revisionsById = new Map(project.revisions.map((revision) => [revision.id, revision]));
  for (const artifact of project.artifacts) {
    const seenInChain = new Set<string>();
    if (artifact.updatedAt < artifact.createdAt) {
      issues.push(`Artifact ${artifact.id} updatedAt precedes createdAt.`);
    }
    if (!artifact.revisionIds.includes(artifact.activeRevisionId)) {
      issues.push(`Artifact ${artifact.id} active revision is outside its chain.`);
    }
    if (artifact.activeRevisionId !== artifact.revisionIds.at(-1)) {
      issues.push(`Artifact ${artifact.id} active revision must be the chain tip.`);
    }
    artifact.revisionIds.forEach((revisionId, index) => {
      const revision = revisionsById.get(revisionId);
      if (!revision || revision.artifactId !== artifact.id) {
        issues.push(`Artifact ${artifact.id} references invalid revision ${revisionId}.`);
        return;
      }
      if (revision.contentHash !== hashRevisionBody(revision.body)) {
        issues.push(`Revision ${revision.id} content hash is invalid.`);
      }
      if (index === 0 && revision.parentRevisionId !== null) {
        issues.push(`Artifact ${artifact.id} root revision must not have a parent.`);
      }
      if (
        index > 0
        && (!revision.parentRevisionId || !seenInChain.has(revision.parentRevisionId))
      ) {
        issues.push(`Revision ${revision.id} must parent an earlier immutable revision.`);
      }
      seenInChain.add(revisionId);
    });
  }

  const artifactRevisionIds = new Set(
    project.artifacts.flatMap(({ revisionIds }) => revisionIds),
  );
  for (const revision of project.revisions) {
    if (!artifactRevisionIds.has(revision.id)) {
      issues.push(`Revision ${revision.id} is not owned by an artifact.`);
    }
  }

  const nodesById = new Map(project.nodes.map((node) => [node.id, node]));
  for (const node of project.nodes) {
    if (!expectedRefKind(project, node)) {
      issues.push(`Node ${node.id} has an invalid ${node.kind} reference ${node.refId}.`);
    }
  }
  for (const edge of project.edges) {
    if (!nodesById.has(edge.fromNodeId) || !nodesById.has(edge.toNodeId)) {
      issues.push(`Edge ${edge.id} references a missing node.`);
    }
    if (edge.fromNodeId === edge.toNodeId) {
      issues.push(`Edge ${edge.id} cannot point to itself.`);
    }
    if (!edgeKindIsValid(project, edge)) {
      issues.push(`Edge ${edge.id} has invalid endpoint kinds for ${edge.type}.`);
    }
  }

  for (const review of project.reviewLinks) {
    const artifact = project.artifacts.find(({ id }) => id === review.artifactId);
    const revision = revisionsById.get(review.revisionId);
    if (!artifact || artifact.phase !== review.phase) {
      issues.push(`Review ${review.id} references an invalid artifact phase.`);
    }
    if (
      !revision
      || revision.artifactId !== review.artifactId
      || revision.contentHash !== review.revisionHash
    ) {
      issues.push(`Review ${review.id} is not bound to an exact artifact revision.`);
    }
  }

  for (const gate of project.gates) issues.push(...gateIntegrityIssues(project, gate));

  const gateIds = new Set(project.gates.map(({ id }) => id));
  for (const decision of project.decisions) {
    if (!gateIds.has(decision.gateId)) {
      issues.push(`Decision ${decision.id} references missing gate ${decision.gateId}.`);
    }
    for (const artifactId of decision.evidenceArtifactIds) {
      const artifact = project.artifacts.find(({ id }) => id === artifactId);
      if (!artifact || artifact.kind !== "evidence" || artifact.phase !== decision.phase) {
        issues.push(`Decision ${decision.id} has invalid same-phase evidence ${artifactId}.`);
      }
    }
  }

  for (const phase of projectPhases) {
    if (!project.gates.some((gate) => gate.phase === phase)) {
      issues.push(`Project is missing the human gate for ${phase}.`);
    }
  }

  return issues;
}

export function parseKingxfordProject(value: unknown): KingxfordProject {
  const parsed = kingxfordProjectSchema.parse(value);
  const issues = collectProjectIntegrityIssues(parsed);
  if (issues.length > 0) throw new ProjectIntegrityError(issues);
  return parsed;
}

export function safeParseKingxfordProject(value: unknown):
  | Readonly<{ success: true; data: KingxfordProject }>
  | Readonly<{ success: false; error: Error }> {
  try {
    return { success: true, data: parseKingxfordProject(value) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error("Invalid Kingxford project."),
    };
  }
}

function makeNode(
  kind: ProjectNodeKind,
  refId: string,
  phase: ProjectPhase,
  label: string,
  createdAt: string,
): ProjectNode {
  return {
    id: stableEntityId("node", kind, refId),
    kind,
    refId,
    phase,
    label,
    status: "known",
    statement: "",
    sourceRef: null,
    createdAt,
  };
}

function makeEdge(
  type: ProjectEdgeType,
  fromNodeId: string,
  toNodeId: string,
  createdAt: string,
): ProjectEdge {
  return {
    id: stableEntityId("edge", type, fromNodeId, toNodeId),
    type,
    fromNodeId,
    toNodeId,
    createdAt,
  };
}

export type CreateKingxfordProjectInput = Readonly<{
  title: string;
  summary?: string;
  activePhase?: ProjectPhase;
  createdAt?: string;
  idSeed?: string;
  origin?: ProjectOrigin;
}>;

export function createKingxfordProject({
  title,
  summary = "",
  activePhase = "discovery",
  createdAt = new Date().toISOString(),
  idSeed,
  origin,
}: CreateKingxfordProjectInput): KingxfordProject {
  const normalizedTitle = title.trim() || "Untitled project";
  const projectId = stableEntityId("project", idSeed ?? normalizedTitle, createdAt);
  const phaseNodes = projectPhases.map((phase) =>
    makeNode("phase", phase, phase, phase[0].toLocaleUpperCase("en") + phase.slice(1), createdAt));
  const gates = projectPhases.map<ProjectGate>((phase) => ({
    id: stableEntityId("gate", projectId, phase),
    phase,
    title: `${phase[0].toLocaleUpperCase("en") + phase.slice(1)} human gate`,
    status: "open",
    approvalMode: "human-only",
    decisionId: null,
    supportedEvidenceArtifactIds: [],
    createdAt,
    decidedAt: null,
  }));
  const gateNodes = gates.map((gate) =>
    makeNode("gate", gate.id, gate.phase, gate.title, createdAt));
  const edges = gates.map((gate) =>
    makeEdge(
      "governs",
      gateNodes.find(({ refId }) => refId === gate.id)!.id,
      phaseNodes.find(({ refId }) => refId === gate.phase)!.id,
      createdAt,
    ));

  return parseKingxfordProject({
    schema: KINGXFORD_PROJECT_SCHEMA,
    schemaVersion: KINGXFORD_PROJECT_SCHEMA_VERSION,
    id: projectId,
    title: normalizedTitle.slice(0, PROJECT_GRAPH_LIMITS.titleCharacters),
    summary: summary.slice(0, PROJECT_GRAPH_LIMITS.summaryCharacters),
    activePhase,
    activeArtifactId: null,
    createdAt,
    updatedAt: createdAt,
    origin: origin ?? {
      kind: "created",
      sourceProjectId: null,
      sourceSnapshotIds: [],
      recordedAt: createdAt,
    },
    artifacts: [],
    revisions: [],
    nodes: [...phaseNodes, ...gateNodes],
    edges,
    reviewLinks: [],
    decisions: [],
    gates,
  });
}

export type AppendArtifactRevisionInput = Readonly<{
  artifactId?: string;
  kind: ArtifactKind;
  title: string;
  phase: ProjectPhase;
  body: ProjectRevisionBody;
  source: RevisionSource;
  createdAt?: string;
  parentRevisionId?: string | null;
}>;

export function appendArtifactRevision(
  projectValue: KingxfordProject,
  input: AppendArtifactRevisionInput,
): KingxfordProject {
  const project = parseKingxfordProject(projectValue);
  const createdAt = input.createdAt ?? new Date().toISOString();
  const existing = input.artifactId
    ? project.artifacts.find(({ id }) => id === input.artifactId)
    : undefined;

  if (input.artifactId && !existing) {
    throw new ProjectIntegrityError([`Artifact ${input.artifactId} does not exist.`]);
  }
  if (existing && (existing.kind !== input.kind || existing.phase !== input.phase)) {
    throw new ProjectIntegrityError([
      `Artifact ${existing.id} kind and phase are immutable.`,
    ]);
  }
  if (existing && existing.revisionIds.length >= PROJECT_GRAPH_LIMITS.revisionsPerArtifact) {
    throw new ProjectIntegrityError([
      `Artifact ${existing.id} reached the immutable revision limit.`,
    ]);
  }
  if (project.revisions.length >= PROJECT_GRAPH_LIMITS.revisionCount) {
    throw new ProjectIntegrityError(["Project reached its immutable revision limit."]);
  }

  const artifactId = existing?.id ?? stableEntityId(
    "artifact",
    project.id,
    input.kind,
    input.phase,
    input.title,
    createdAt,
  );
  const chainTip = existing?.activeRevisionId ?? null;
  const parentRevisionId = input.parentRevisionId === undefined
    ? chainTip
    : input.parentRevisionId;
  if (!existing && parentRevisionId !== null) {
    throw new ProjectIntegrityError(["A root revision cannot have a parent."]);
  }
  if (existing && (!parentRevisionId || !existing.revisionIds.includes(parentRevisionId))) {
    throw new ProjectIntegrityError([
      `Revision parent must be an earlier revision of ${existing.id}.`,
    ]);
  }

  const contentHash = hashRevisionBody(input.body);
  const revision: ProjectRevision = {
    id: stableEntityId(
      "revision",
      artifactId,
      parentRevisionId,
      contentHash,
      createdAt,
    ),
    artifactId,
    parentRevisionId,
    createdAt,
    source: input.source,
    contentHash,
    body: input.body,
  };
  if (project.revisions.some(({ id }) => id === revision.id)) return project;

  const artifact: ProjectArtifact = existing
    ? {
        ...existing,
        title: input.title.trim().slice(0, 160) || existing.title,
        activeRevisionId: revision.id,
        revisionIds: [...existing.revisionIds, revision.id],
        updatedAt: createdAt,
      }
    : {
        id: artifactId,
        kind: input.kind,
        title: input.title.trim().slice(0, 160) || `${input.kind} artifact`,
        phase: input.phase,
        activeRevisionId: revision.id,
        revisionIds: [revision.id],
        createdAt,
        updatedAt: createdAt,
      };

  const artifactNode = existing
    ? project.nodes.find((node) => node.kind === "artifact" && node.refId === artifactId)!
    : makeNode("artifact", artifactId, input.phase, artifact.title, createdAt);
  const revisionNode = makeNode(
    "revision",
    revision.id,
    input.phase,
    `${artifact.title} revision`,
    createdAt,
  );
  const phaseNode = project.nodes.find(
    (node) => node.kind === "phase" && node.refId === input.phase,
  )!;
  const parentNode = parentRevisionId
    ? project.nodes.find(
        (node) => node.kind === "revision" && node.refId === parentRevisionId,
      )
    : undefined;
  const newEdges = [
    makeEdge("materializes", artifactNode.id, revisionNode.id, createdAt),
    ...(existing ? [] : [makeEdge("contains", phaseNode.id, artifactNode.id, createdAt)]),
    ...(parentNode ? [makeEdge("revises", revisionNode.id, parentNode.id, createdAt)] : []),
  ];

  return parseKingxfordProject({
    ...project,
    activePhase: input.phase,
    activeArtifactId: artifactId,
    updatedAt: createdAt,
    artifacts: existing
      ? project.artifacts.map((current) => current.id === artifactId ? artifact : current)
      : [...project.artifacts, artifact],
    revisions: [...project.revisions, revision],
    nodes: existing
      ? [...project.nodes, revisionNode]
      : [...project.nodes, artifactNode, revisionNode],
    edges: [...project.edges, ...newEdges],
  });
}

export type AddProjectReviewLinkInput = Omit<ProjectReviewLink, "id">;

export function addProjectReviewLink(
  projectValue: KingxfordProject,
  input: AddProjectReviewLinkInput,
): KingxfordProject {
  const project = parseKingxfordProject(projectValue);
  const revision = project.revisions.find(({ id }) => id === input.revisionId);
  const artifact = project.artifacts.find(({ id }) => id === input.artifactId);
  if (
    !revision
    || !artifact
    || revision.artifactId !== artifact.id
    || revision.contentHash !== input.revisionHash
    || artifact.phase !== input.phase
  ) {
    throw new ProjectIntegrityError([
      "Review links must bind to an exact existing artifact revision and hash.",
    ]);
  }
  if (project.reviewLinks.length >= PROJECT_GRAPH_LIMITS.reviewLinkCount) {
    throw new ProjectIntegrityError(["Project reached its review-link limit."]);
  }

  const review: ProjectReviewLink = {
    ...input,
    id: stableEntityId(
      "review",
      project.id,
      input.requestId,
      input.artifactId,
      input.revisionId,
      input.snapshotId,
    ),
  };
  if (project.reviewLinks.some(({ id }) => id === review.id)) return project;
  const reviewNode = makeNode(
    "review",
    review.id,
    review.phase,
    `Review ${review.requestId}`,
    review.createdAt,
  );
  const revisionNode = project.nodes.find(
    (node) => node.kind === "revision" && node.refId === review.revisionId,
  )!;

  return parseKingxfordProject({
    ...project,
    updatedAt: review.createdAt,
    reviewLinks: [...project.reviewLinks, review],
    nodes: [...project.nodes, reviewNode],
    edges: [
      ...project.edges,
      makeEdge("reviews", reviewNode.id, revisionNode.id, review.createdAt),
    ],
  });
}

export type RecordHumanGateDecisionInput = Readonly<{
  phase: ProjectPhase;
  outcome: "approved" | "rejected";
  rationale: string;
  evidenceArtifactIds: readonly string[];
  actorId: string;
  recordedAt?: string;
}>;

export function recordHumanGateDecision(
  projectValue: KingxfordProject,
  input: RecordHumanGateDecisionInput,
): KingxfordProject {
  const project = parseKingxfordProject(projectValue);
  const gate = project.gates.find(({ phase }) => phase === input.phase);
  if (!gate) throw new ProjectIntegrityError([`Missing ${input.phase} gate.`]);
  if (gate.status !== "open") {
    throw new ProjectIntegrityError([`Gate ${gate.id} already has an immutable decision.`]);
  }
  const evidenceArtifactIds = Array.from(new Set(input.evidenceArtifactIds));
  if (evidenceArtifactIds.length === 0) {
    throw new ProjectIntegrityError(["Human gate decisions require supported evidence."]);
  }
  for (const artifactId of evidenceArtifactIds) {
    const artifact = project.artifacts.find(({ id }) => id === artifactId);
    if (!artifact || artifact.kind !== "evidence" || artifact.phase !== input.phase) {
      throw new ProjectIntegrityError([
        `Evidence ${artifactId} must be an evidence artifact in ${input.phase}.`,
      ]);
    }
  }

  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const decision: ProjectDecision = {
    id: stableEntityId(
      "decision",
      project.id,
      gate.id,
      input.outcome,
      evidenceArtifactIds,
      input.actorId,
      recordedAt,
    ),
    phase: input.phase,
    gateId: gate.id,
    outcome: input.outcome,
    rationale: input.rationale.trim().slice(0, 1600),
    evidenceArtifactIds,
    provenance: {
      kind: "human-confirmation",
      actorId: input.actorId.trim().slice(0, 160),
      recordedAt,
    },
  };
  const decidedGate: ProjectGate = {
    ...gate,
    status: input.outcome,
    decisionId: decision.id,
    supportedEvidenceArtifactIds: evidenceArtifactIds,
    decidedAt: recordedAt,
  };
  const decisionNode = makeNode(
    "decision",
    decision.id,
    decision.phase,
    `${input.outcome} · human decision`,
    recordedAt,
  );
  const gateNode = project.nodes.find(
    (node) => node.kind === "gate" && node.refId === gate.id,
  )!;
  const evidenceEdges = evidenceArtifactIds.map((artifactId) => {
    const node = project.nodes.find(
      (candidate) => candidate.kind === "artifact" && candidate.refId === artifactId,
    )!;
    return makeEdge("supports", node.id, decisionNode.id, recordedAt);
  });

  return parseKingxfordProject({
    ...project,
    updatedAt: recordedAt,
    decisions: [...project.decisions, decision],
    gates: project.gates.map((current) => current.id === gate.id ? decidedGate : current),
    nodes: [...project.nodes, decisionNode],
    edges: [
      ...project.edges,
      ...evidenceEdges,
      makeEdge("decides", decisionNode.id, gateNode.id, recordedAt),
    ],
  });
}

export type UpsertProjectNodeInput = Readonly<{
  key: string;
  kind: SemanticProjectNodeKind;
  phase: ProjectPhase;
  label: string;
  statement: string;
  status: ProjectNodeStatus;
  sourceRef?: string | null;
  recordedAt?: string;
}>;

export function upsertProjectNode(
  projectValue: KingxfordProject,
  input: UpsertProjectNodeInput,
): KingxfordProject {
  const project = parseKingxfordProject(projectValue);
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const id = stableEntityId("node", project.id, input.kind, input.key);
  const existing = project.nodes.find((node) => node.id === id);
  if (existing && (existing.kind !== input.kind || existing.phase !== input.phase)) {
    throw new ProjectIntegrityError([`Semantic node ${id} kind and phase are immutable.`]);
  }
  const node: ProjectNode = {
    id,
    kind: input.kind,
    refId: id,
    phase: input.phase,
    label: input.label.trim().slice(0, 180) || input.kind,
    statement: input.statement.slice(0, 1200),
    status: input.status,
    sourceRef: input.sourceRef?.slice(0, 320) || null,
    createdAt: existing?.createdAt ?? recordedAt,
  };
  const phaseNode = project.nodes.find(
    (candidate) => candidate.kind === "phase" && candidate.refId === input.phase,
  )!;
  const contains = makeEdge("contains", phaseNode.id, node.id, recordedAt);
  return parseKingxfordProject({
    ...project,
    updatedAt: recordedAt,
    nodes: existing
      ? project.nodes.map((candidate) => candidate.id === id ? node : candidate)
      : [...project.nodes, node],
    edges: existing || project.edges.some(({ id: edgeId }) => edgeId === contains.id)
      ? project.edges
      : [...project.edges, contains],
  });
}

export type ConnectProjectNodesInput = Readonly<{
  type: ProjectEdgeType;
  fromNodeId: string;
  toNodeId: string;
  recordedAt?: string;
}>;

export function connectProjectNodes(
  projectValue: KingxfordProject,
  input: ConnectProjectNodesInput,
): KingxfordProject {
  const project = parseKingxfordProject(projectValue);
  if (!edgeKindIsValid(project, input)) {
    throw new ProjectIntegrityError([
      `Invalid ${input.type} relationship between ${input.fromNodeId} and ${input.toNodeId}.`,
    ]);
  }
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  const edge = makeEdge(input.type, input.fromNodeId, input.toNodeId, recordedAt);
  if (project.edges.some(({ id }) => id === edge.id)) return project;
  if (project.edges.length >= PROJECT_GRAPH_LIMITS.edgeCount) {
    throw new ProjectIntegrityError(["Project reached its relationship limit."]);
  }
  return parseKingxfordProject({
    ...project,
    updatedAt: recordedAt,
    edges: [...project.edges, edge],
  });
}

export function textRevisionBody(text: string): ProjectRevisionBody {
  return { type: "text", text };
}

export function codeRevisionBody(code: CodeFiles): ProjectRevisionBody {
  return { type: "code", ...code };
}
