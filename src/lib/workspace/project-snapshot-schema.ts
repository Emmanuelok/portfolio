import { z } from "zod";

import {
  artifactKinds,
  hashRevisionBody,
  parseKingxfordProject,
  projectEdgeTypes,
  projectNodeKinds,
  projectNodeStatuses,
  projectPhases,
  revisionSources,
  stableEntityId,
  stableHash,
  stableStringify,
  type KingxfordProject,
  type ProjectRevisionBody,
} from "./project-graph";

export const PROJECT_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export const PROJECT_SNAPSHOT_BOUNDS = Object.freeze({
  nodes: 18,
  edges: 24,
  artifacts: 6,
  gates: 6,
  decisions: 6,
  reviewLinks: 6,
  characters: 14_000,
});

const semanticSnapshotNodeKinds = new Set([
  "problem", "stakeholder", "outcome", "constraint", "question",
  "assumption", "evidence", "risk", "test", "deliverable",
]);

const entityId = z.string().regex(/^kx_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}$/);
const hash = z.string().regex(/^kxhash_[0-9a-f]{32}$/);
const isoDate = z.string().datetime({ offset: true });
const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().max(1_000) }).strict(),
  z.object({
    type: z.literal("code"),
    html: z.string().max(400),
    css: z.string().max(400),
    javascript: z.string().max(400),
  }).strict(),
]);

const snapshotArtifactSchema = z.object({
  id: entityId,
  kind: z.enum(artifactKinds),
  title: z.string().min(1).max(160),
  phase: z.enum(projectPhases),
  activeRevision: z.object({
    id: entityId,
    parentRevisionId: entityId.nullable(),
    createdAt: isoDate,
    source: z.enum(revisionSources),
    contentHash: hash,
    bodyHash: hash,
    truncated: z.boolean(),
    body: bodySchema,
  }).strict(),
}).strict();

const snapshotNodeSchema = z.object({
  id: entityId,
  kind: z.enum(projectNodeKinds),
  refId: z.string().min(1).max(120),
  phase: z.enum(projectPhases),
  label: z.string().min(1).max(180),
  status: z.enum(projectNodeStatuses),
  statement: z.string().max(240),
  sourceRef: z.string().max(320).nullable(),
}).strict();

const snapshotEdgeSchema = z.object({
  id: entityId,
  type: z.enum(projectEdgeTypes),
  fromNodeId: entityId,
  toNodeId: entityId,
}).strict();

const snapshotGateSchema = z.object({
  id: entityId,
  phase: z.enum(projectPhases),
  title: z.string().min(1).max(180),
  status: z.enum(["open", "approved", "rejected"]),
  decisionId: entityId.nullable(),
  supportedEvidenceArtifactIds: z.array(entityId).max(6),
}).strict();

const snapshotDecisionSchema = z.object({
  id: entityId,
  phase: z.enum(projectPhases),
  gateId: entityId,
  outcome: z.enum(["approved", "rejected"]),
  evidenceArtifactIds: z.array(entityId).min(1).max(6),
  provenance: z.object({
    kind: z.literal("human-confirmation"),
    actorId: z.string().min(1).max(160),
    recordedAt: isoDate,
  }).strict(),
}).strict();

const snapshotReviewLinkSchema = z.object({
  id: entityId,
  phase: z.enum(projectPhases),
  artifactId: entityId,
  revisionId: entityId,
  revisionHash: hash,
  requestId: z.string().min(1).max(160),
  snapshotId: entityId,
  snapshotHash: hash,
  contextHash: hash,
  createdAt: isoDate,
}).strict();

export const projectSnapshotSchema = z.object({
  schema: z.literal("kingxford-project-snapshot"),
  schemaVersion: z.literal(PROJECT_SNAPSHOT_SCHEMA_VERSION),
  id: entityId,
  hash,
  characterCount: z.number().int().nonnegative().max(PROJECT_SNAPSHOT_BOUNDS.characters),
  project: z.object({
    id: entityId,
    title: z.string().min(1).max(160),
    activePhase: z.enum(projectPhases),
    updatedAt: isoDate,
  }).strict(),
  artifacts: z.array(snapshotArtifactSchema).max(PROJECT_SNAPSHOT_BOUNDS.artifacts),
  nodes: z.array(snapshotNodeSchema).max(PROJECT_SNAPSHOT_BOUNDS.nodes),
  edges: z.array(snapshotEdgeSchema).max(PROJECT_SNAPSHOT_BOUNDS.edges),
  gates: z.array(snapshotGateSchema).max(PROJECT_SNAPSHOT_BOUNDS.gates),
  decisions: z.array(snapshotDecisionSchema).max(PROJECT_SNAPSHOT_BOUNDS.decisions),
  reviewLinks: z.array(snapshotReviewLinkSchema).max(PROJECT_SNAPSHOT_BOUNDS.reviewLinks),
}).strict();

export type KingxfordProjectSnapshot = z.infer<typeof projectSnapshotSchema>;

type SnapshotPayload = Omit<
  KingxfordProjectSnapshot,
  "id" | "hash" | "characterCount"
>;

function snapshotPayload(
  snapshot: KingxfordProjectSnapshot,
): SnapshotPayload {
  return {
    schema: snapshot.schema,
    schemaVersion: snapshot.schemaVersion,
    project: snapshot.project,
    artifacts: snapshot.artifacts,
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    gates: snapshot.gates,
    decisions: snapshot.decisions,
    reviewLinks: snapshot.reviewLinks,
  };
}

export function computeProjectSnapshotIntegrity(
  snapshot: KingxfordProjectSnapshot,
) {
  const payload = snapshotPayload(snapshot);
  const payloadHash = stableHash(payload);
  return {
    id: stableEntityId("snapshot", payload.project.id, payload.project.updatedAt, payloadHash),
    hash: payloadHash,
    characterCount: stableStringify(payload).length,
  } as const;
}

function duplicates(values: readonly string[]) {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

function snapshotIntegrityIssues(snapshot: KingxfordProjectSnapshot) {
  const issues: string[] = [];
  const computed = computeProjectSnapshotIntegrity(snapshot);
  if (snapshot.id !== computed.id) issues.push("Snapshot ID is not deterministic for its payload.");
  if (snapshot.hash !== computed.hash) issues.push("Snapshot hash does not match its payload.");
  if (snapshot.characterCount !== computed.characterCount) {
    issues.push("Snapshot character count does not match its payload.");
  }
  if (computed.characterCount > PROJECT_SNAPSHOT_BOUNDS.characters) {
    issues.push("Snapshot exceeds the 14,000 character boundary.");
  }

  const artifactIds = snapshot.artifacts.map(({ id }) => id);
  const revisionIds = snapshot.artifacts.map(({ activeRevision }) => activeRevision.id);
  const nodeIds = snapshot.nodes.map(({ id }) => id);
  const edgeIds = snapshot.edges.map(({ id }) => id);
  const gateIds = snapshot.gates.map(({ id }) => id);
  const decisionIds = snapshot.decisions.map(({ id }) => id);
  const reviewIds = snapshot.reviewLinks.map(({ id }) => id);
  for (const [label, values] of [
    ["artifact", artifactIds],
    ["revision", revisionIds],
    ["node", nodeIds],
    ["edge", edgeIds],
    ["gate", gateIds],
    ["decision", decisionIds],
    ["review", reviewIds],
  ] as const) {
    if (duplicates(values).length > 0) issues.push(`Snapshot has duplicate ${label} IDs.`);
  }

  const artifacts = new Map(snapshot.artifacts.map((artifact) => [artifact.id, artifact]));
  for (const artifact of snapshot.artifacts) {
    if (artifact.activeRevision.bodyHash !== hashRevisionBody(artifact.activeRevision.body)) {
      issues.push(`Artifact ${artifact.id} excerpt body hash is invalid.`);
    }
  }
  const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const gateIdSet = new Set(gateIds);
  const decisionIdSet = new Set(decisionIds);
  const reviewIdSet = new Set(reviewIds);
  for (const node of snapshot.nodes) {
    const refIsValid = node.kind === "phase"
      ? projectPhases.includes(node.refId as (typeof projectPhases)[number])
      : node.kind === "artifact"
        ? artifactIds.includes(node.refId)
        : node.kind === "revision"
          ? revisionIds.includes(node.refId)
          : node.kind === "gate"
            ? gateIdSet.has(node.refId)
            : node.kind === "decision"
              ? decisionIdSet.has(node.refId)
              : node.kind === "review"
                ? reviewIdSet.has(node.refId)
                : semanticSnapshotNodeKinds.has(node.kind) && node.refId === node.id;
    if (!refIsValid) issues.push(`Node ${node.id} references an entity outside the snapshot.`);
  }
  for (const edge of snapshot.edges) {
    if (!nodes.has(edge.fromNodeId) || !nodes.has(edge.toNodeId)) {
      issues.push(`Edge ${edge.id} references a node outside the snapshot.`);
    }
  }
  for (const review of snapshot.reviewLinks) {
    const artifact = artifacts.get(review.artifactId);
    if (
      !artifact
      || artifact.phase !== review.phase
      || artifact.activeRevision.id !== review.revisionId
      || artifact.activeRevision.contentHash !== review.revisionHash
    ) {
      issues.push(`Review ${review.id} is not bound to the selected active revision.`);
    }
  }

  const decisions = new Map(snapshot.decisions.map((decision) => [decision.id, decision]));
  for (const gate of snapshot.gates) {
    if (gate.status === "open") {
      if (gate.decisionId !== null) issues.push(`Open gate ${gate.id} carries a decision.`);
      continue;
    }
    const decision = gate.decisionId ? decisions.get(gate.decisionId) : undefined;
    if (!decision || decision.gateId !== gate.id || decision.outcome !== gate.status) {
      issues.push(`Gate ${gate.id} lacks matching human decision provenance.`);
      continue;
    }
    if (gate.supportedEvidenceArtifactIds.length === 0) {
      issues.push(`Gate ${gate.id} lacks snapshot evidence.`);
    }
    for (const evidenceId of gate.supportedEvidenceArtifactIds) {
      const evidence = artifacts.get(evidenceId);
      if (
        !evidence
        || evidence.kind !== "evidence"
        || evidence.phase !== gate.phase
        || !decision.evidenceArtifactIds.includes(evidenceId)
      ) {
        issues.push(`Gate ${gate.id} evidence is missing or from another phase.`);
      }
    }
  }
  return issues;
}

export function assertProjectSnapshotIntegrity(snapshot: KingxfordProjectSnapshot) {
  const issues = snapshotIntegrityIssues(snapshot);
  if (issues.length > 0) throw new Error(`Invalid project snapshot: ${issues.join("; ")}`);
  return snapshot;
}

export function parseProjectSnapshot(value: unknown): KingxfordProjectSnapshot {
  return assertProjectSnapshotIntegrity(projectSnapshotSchema.parse(value));
}

export function safeParseProjectSnapshot(value: unknown):
  | Readonly<{ success: true; data: KingxfordProjectSnapshot }>
  | Readonly<{ success: false; error: Error }> {
  try {
    return { success: true, data: parseProjectSnapshot(value) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error("Invalid project snapshot."),
    };
  }
}

function excerptBody(body: ProjectRevisionBody) {
  if (body.type === "text") {
    const text = body.text.slice(0, 900);
    return { body: { type: "text", text } as const, truncated: text.length < body.text.length };
  }
  const html = body.html.slice(0, 300);
  const css = body.css.slice(0, 300);
  const javascript = body.javascript.slice(0, 300);
  return {
    body: { type: "code", html, css, javascript } as const,
    truncated: html.length < body.html.length
      || css.length < body.css.length
      || javascript.length < body.javascript.length,
  };
}

function trimPayloadToBoundary(payloadValue: SnapshotPayload): SnapshotPayload {
  let payload: SnapshotPayload = {
    ...payloadValue,
    artifacts: [...payloadValue.artifacts],
    nodes: [...payloadValue.nodes],
    edges: [...payloadValue.edges],
    gates: [...payloadValue.gates],
    decisions: [...payloadValue.decisions],
    reviewLinks: [...payloadValue.reviewLinks],
  };
  const isOversized = () =>
    stableStringify(payload).length > PROJECT_SNAPSHOT_BOUNDS.characters;

  while (isOversized() && payload.edges.length > 0) {
    payload = { ...payload, edges: payload.edges.slice(0, -1) };
  }
  while (isOversized() && payload.nodes.length > 6) {
    const nodes = payload.nodes.slice(0, -1);
    const ids = new Set(nodes.map(({ id }) => id));
    payload = {
      ...payload,
      nodes,
      edges: payload.edges.filter(
        ({ fromNodeId, toNodeId }) => ids.has(fromNodeId) && ids.has(toNodeId),
      ),
    };
  }
  while (isOversized() && payload.reviewLinks.length > 0) {
    payload = { ...payload, reviewLinks: payload.reviewLinks.slice(0, -1) };
  }
  while (isOversized() && payload.gates.length > 0) {
    const removed = payload.gates.at(-1)!;
    payload = {
      ...payload,
      gates: payload.gates.slice(0, -1),
      decisions: payload.decisions.filter(({ gateId }) => gateId !== removed.id),
      nodes: payload.nodes.filter(({ refId }) =>
        refId !== removed.id && refId !== removed.decisionId),
    };
  }
  if (isOversized()) {
    payload = {
      ...payload,
      artifacts: payload.artifacts.map((artifact) => {
        const body = artifact.activeRevision.body.type === "text"
          ? { type: "text" as const, text: artifact.activeRevision.body.text.slice(0, 120) }
          : {
              type: "code" as const,
              html: artifact.activeRevision.body.html.slice(0, 40),
              css: artifact.activeRevision.body.css.slice(0, 40),
              javascript: artifact.activeRevision.body.javascript.slice(0, 40),
            };
        return {
          ...artifact,
          activeRevision: {
            ...artifact.activeRevision,
            body,
            bodyHash: hashRevisionBody(body),
            truncated: true,
          },
        };
      }),
    };
  }
  while (isOversized() && payload.artifacts.length > 1) {
    const removed = payload.artifacts.at(-1)!;
    const artifactIds = new Set(
      payload.artifacts.slice(0, -1).map(({ id }) => id),
    );
    const gates = payload.gates
      .map((gate) => ({
        ...gate,
        supportedEvidenceArtifactIds: gate.supportedEvidenceArtifactIds.filter(
          (id) => artifactIds.has(id),
        ),
      }))
      .filter((gate) => gate.status === "open" || gate.supportedEvidenceArtifactIds.length > 0);
    const gateIds = new Set(gates.map(({ id }) => id));
    const decisions = payload.decisions
      .filter(({ gateId }) => gateIds.has(gateId))
      .map((decision) => ({
        ...decision,
        evidenceArtifactIds: decision.evidenceArtifactIds.filter((id) => artifactIds.has(id)),
      }));
    const nodeRefs = new Set([
      ...artifactIds,
      ...payload.artifacts.slice(0, -1).map(({ activeRevision }) => activeRevision.id),
      ...gates.map(({ id }) => id),
      ...decisions.map(({ id }) => id),
      ...payload.reviewLinks
        .filter(({ artifactId }) => artifactIds.has(artifactId))
        .map(({ id }) => id),
    ]);
    const nodes = payload.nodes.filter((node) =>
      (node.refId !== removed.id && node.refId !== removed.activeRevision.id)
      && (node.kind === "phase"
        || semanticSnapshotNodeKinds.has(node.kind)
        || nodeRefs.has(node.refId)));
    const nodeIds = new Set(nodes.map(({ id }) => id));
    payload = {
      ...payload,
      artifacts: payload.artifacts.slice(0, -1),
      gates,
      decisions,
      reviewLinks: payload.reviewLinks.filter(({ artifactId }) => artifactIds.has(artifactId)),
      nodes,
      edges: payload.edges.filter(({ fromNodeId, toNodeId }) =>
        nodeIds.has(fromNodeId) && nodeIds.has(toNodeId)),
    };
  }
  while (isOversized() && payload.nodes.length > 0) {
    const nodes = payload.nodes.slice(0, -1);
    const ids = new Set(nodes.map(({ id }) => id));
    payload = {
      ...payload,
      nodes,
      edges: payload.edges.filter(
        ({ fromNodeId, toNodeId }) => ids.has(fromNodeId) && ids.has(toNodeId),
      ),
    };
  }
  if (isOversized()) {
    throw new Error("Project metadata cannot fit the bounded snapshot envelope.");
  }
  return payload;
}

export type BuildProjectSnapshotOptions = Readonly<{
  activeArtifactId?: string | null;
}>;

export function buildProjectSnapshot(
  projectValue: KingxfordProject,
  options: BuildProjectSnapshotOptions = {},
): KingxfordProjectSnapshot {
  const project = parseKingxfordProject(projectValue);
  const preferredArtifactId = options.activeArtifactId === undefined
    ? project.activeArtifactId
    : options.activeArtifactId;
  const selectedIds: string[] = [];
  if (preferredArtifactId && project.artifacts.some(({ id }) => id === preferredArtifactId)) {
    selectedIds.push(preferredArtifactId);
  }

  const eligibleGates = [] as typeof project.gates;
  for (const gate of project.gates) {
    if (gate.status === "open") {
      eligibleGates.push(gate);
      continue;
    }
    const evidenceId = gate.supportedEvidenceArtifactIds.find((id) =>
      project.artifacts.some((artifact) => artifact.id === id));
    if (!evidenceId) continue;
    if (!selectedIds.includes(evidenceId)) {
      if (selectedIds.length >= PROJECT_SNAPSHOT_BOUNDS.artifacts) continue;
      selectedIds.push(evidenceId);
    }
    eligibleGates.push(gate);
  }

  const rankedArtifacts = [...project.artifacts].sort((left, right) => {
    const phaseDelta = Number(right.phase === project.activePhase)
      - Number(left.phase === project.activePhase);
    return phaseDelta || right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
  });
  for (const artifact of rankedArtifacts) {
    if (selectedIds.length >= PROJECT_SNAPSHOT_BOUNDS.artifacts) break;
    if (!selectedIds.includes(artifact.id)) selectedIds.push(artifact.id);
  }

  const selectedArtifacts = selectedIds.flatMap((artifactId) => {
    const artifact = project.artifacts.find(({ id }) => id === artifactId);
    if (!artifact) return [];
    const revision = project.revisions.find(({ id }) => id === artifact.activeRevisionId);
    if (!revision) return [];
    const excerpt = excerptBody(revision.body);
    return [{
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      phase: artifact.phase,
      activeRevision: {
        id: revision.id,
        parentRevisionId: revision.parentRevisionId,
        createdAt: revision.createdAt,
        source: revision.source,
        contentHash: revision.contentHash,
        bodyHash: hashRevisionBody(excerpt.body),
        truncated: excerpt.truncated,
        body: excerpt.body,
      },
    }];
  });
  const selectedArtifactIds = new Set(selectedArtifacts.map(({ id }) => id));
  const selectedRevisionIds = new Set(
    selectedArtifacts.map(({ activeRevision }) => activeRevision.id),
  );

  const gates = eligibleGates.slice(0, PROJECT_SNAPSHOT_BOUNDS.gates).flatMap((gate) => {
    const evidenceIds = gate.supportedEvidenceArtifactIds
      .filter((id) => selectedArtifactIds.has(id))
      .slice(0, PROJECT_SNAPSHOT_BOUNDS.artifacts);
    if (gate.status !== "open" && evidenceIds.length === 0) return [];
    return [{
      id: gate.id,
      phase: gate.phase,
      title: gate.title,
      status: gate.status,
      decisionId: gate.decisionId,
      supportedEvidenceArtifactIds: evidenceIds,
    }];
  });
  const gateIdSet = new Set(gates.map(({ id }) => id));
  const decisions = project.decisions
    .filter(({ gateId }) => gateIdSet.has(gateId))
    .slice(-PROJECT_SNAPSHOT_BOUNDS.decisions)
    .map((decision) => ({
      id: decision.id,
      phase: decision.phase,
      gateId: decision.gateId,
      outcome: decision.outcome,
      evidenceArtifactIds: decision.evidenceArtifactIds
        .filter((id) => selectedArtifactIds.has(id))
        .slice(0, PROJECT_SNAPSHOT_BOUNDS.artifacts),
      provenance: decision.provenance,
    }));
  const reviewLinks = project.reviewLinks
    .filter((review) => selectedArtifactIds.has(review.artifactId)
      && selectedRevisionIds.has(review.revisionId))
    .slice(-PROJECT_SNAPSHOT_BOUNDS.reviewLinks)
    .map((review) => ({ ...review }));

  const permittedRefIds = new Set<string>([
    ...projectPhases,
    ...selectedArtifactIds,
    ...selectedRevisionIds,
    ...gates.map(({ id }) => id),
    ...decisions.map(({ id }) => id),
    ...reviewLinks.map(({ id }) => id),
  ]);
  const selectedNodes = project.nodes
    .filter((node) => node.kind === "problem"
      || node.kind === "stakeholder"
      || node.kind === "outcome"
      || node.kind === "constraint"
      || node.kind === "question"
      || node.kind === "assumption"
      || node.kind === "evidence"
      || node.kind === "risk"
      || node.kind === "test"
      || node.kind === "deliverable"
      || permittedRefIds.has(node.refId))
    .sort((left, right) => {
      const activeDelta = Number(right.phase === project.activePhase)
        - Number(left.phase === project.activePhase);
      return activeDelta || right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id);
    })
    .slice(0, PROJECT_SNAPSHOT_BOUNDS.nodes)
    .map((node) => ({
      id: node.id,
      kind: node.kind,
      refId: node.refId,
      phase: node.phase,
      label: node.label,
      status: node.status,
      statement: node.statement.slice(0, 240),
      sourceRef: node.sourceRef,
    }));
  const selectedNodeIds = new Set(selectedNodes.map(({ id }) => id));
  const edges = project.edges
    .filter((edge) => selectedNodeIds.has(edge.fromNodeId) && selectedNodeIds.has(edge.toNodeId))
    .slice(-PROJECT_SNAPSHOT_BOUNDS.edges)
    .map((edge) => ({
      id: edge.id,
      type: edge.type,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
    }));

  const payload = trimPayloadToBoundary({
    schema: "kingxford-project-snapshot",
    schemaVersion: PROJECT_SNAPSHOT_SCHEMA_VERSION,
    project: {
      id: project.id,
      title: project.title,
      activePhase: project.activePhase,
      updatedAt: project.updatedAt,
    },
    artifacts: selectedArtifacts,
    nodes: selectedNodes,
    edges,
    gates,
    decisions,
    reviewLinks,
  });
  const payloadHash = stableHash(payload);
  const snapshot = {
    ...payload,
    id: stableEntityId("snapshot", project.id, project.updatedAt, payloadHash),
    hash: payloadHash,
    characterCount: stableStringify(payload).length,
  };
  return parseProjectSnapshot(snapshot);
}
