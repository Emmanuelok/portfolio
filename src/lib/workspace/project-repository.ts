import { z } from "zod";

import { tryMigrateCanvasV1ToProject, CANVAS_V1_STORAGE_KEY } from "./canvas-project";
import {
  parseKingxfordProject,
  safeParseKingxfordProject,
  stableEntityId,
  type KingxfordProject,
  type ProjectDecision,
  type ProjectEdge,
  type ProjectGate,
  type ProjectNode,
  type ProjectReviewLink,
  type ProjectRevision,
} from "./project-graph";

export const PROJECT_REPOSITORY_STORAGE_KEY = "kingxford:projects:v2" as const;
export const PROJECT_REPOSITORY_SCHEMA_VERSION = 2 as const;
export const PROJECT_REPOSITORY_MAX_PROJECTS = 8 as const;
export const PROJECT_REPOSITORY_MAX_BYTES = 1_800_000 as const;

export type ProjectRepositoryState = Readonly<{
  schema: "kingxford-project-repository";
  schemaVersion: typeof PROJECT_REPOSITORY_SCHEMA_VERSION;
  activeProjectId: string | null;
  projects: readonly KingxfordProject[];
}>;

export type ProjectStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const repositoryEnvelopeSchema = z.object({
  schema: z.literal("kingxford-project-repository"),
  schemaVersion: z.literal(PROJECT_REPOSITORY_SCHEMA_VERSION),
  activeProjectId: z.string().nullable(),
  projects: z.array(z.unknown()).max(PROJECT_REPOSITORY_MAX_PROJECTS),
}).strict();

function getDefaultStorage(): ProjectStorage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function createEmptyProjectRepository(): ProjectRepositoryState {
  return {
    schema: "kingxford-project-repository",
    schemaVersion: PROJECT_REPOSITORY_SCHEMA_VERSION,
    activeProjectId: null,
    projects: [],
  };
}

export function parseProjectRepository(value: unknown): ProjectRepositoryState {
  const envelope = repositoryEnvelopeSchema.parse(value);
  const projects = envelope.projects.map(parseKingxfordProject);
  const ids = projects.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Project repository contains duplicate project IDs.");
  }
  if (
    envelope.activeProjectId !== null
    && !projects.some(({ id }) => id === envelope.activeProjectId)
  ) {
    throw new Error("Project repository activeProjectId does not exist.");
  }
  return { ...envelope, projects };
}

export function safeParseProjectRepository(value: unknown):
  | Readonly<{ success: true; data: ProjectRepositoryState }>
  | Readonly<{ success: false; error: Error }> {
  try {
    return { success: true, data: parseProjectRepository(value) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error("Invalid project repository."),
    };
  }
}

export function serializeProjectRepository(state: ProjectRepositoryState) {
  const validated = parseProjectRepository(state);
  const serialized = JSON.stringify(validated);
  if (new TextEncoder().encode(serialized).byteLength > PROJECT_REPOSITORY_MAX_BYTES) {
    throw new Error("Project repository exceeds its local storage boundary.");
  }
  return serialized;
}

export function loadProjectRepository(
  storage: ProjectStorage | null = getDefaultStorage(),
): ProjectRepositoryState {
  if (!storage) return createEmptyProjectRepository();
  const stored = storage.getItem(PROJECT_REPOSITORY_STORAGE_KEY);
  if (stored) {
    if (new TextEncoder().encode(stored).byteLength > PROJECT_REPOSITORY_MAX_BYTES) {
      throw new Error("Stored project repository exceeds its safety boundary.");
    }
    return parseProjectRepository(JSON.parse(stored));
  }

  const legacy = storage.getItem(CANVAS_V1_STORAGE_KEY);
  if (!legacy) return createEmptyProjectRepository();
  const migrated = tryMigrateCanvasV1ToProject(JSON.parse(legacy));
  if (!migrated) return createEmptyProjectRepository();
  const state = upsertRepositoryProject(createEmptyProjectRepository(), migrated);
  saveProjectRepository(state, storage);
  return state;
}

export function saveProjectRepository(
  state: ProjectRepositoryState,
  storage: ProjectStorage | null = getDefaultStorage(),
) {
  if (!storage) return state;
  storage.setItem(PROJECT_REPOSITORY_STORAGE_KEY, serializeProjectRepository(state));
  return state;
}

export function upsertRepositoryProject(
  stateValue: ProjectRepositoryState,
  projectValue: KingxfordProject,
): ProjectRepositoryState {
  const state = parseProjectRepository(stateValue);
  const project = parseKingxfordProject(projectValue);
  const exists = state.projects.some(({ id }) => id === project.id);
  if (!exists && state.projects.length >= PROJECT_REPOSITORY_MAX_PROJECTS) {
    throw new Error(`Only ${PROJECT_REPOSITORY_MAX_PROJECTS} local projects are retained.`);
  }
  return parseProjectRepository({
    ...state,
    activeProjectId: project.id,
    projects: exists
      ? state.projects.map((current) => current.id === project.id ? project : current)
      : [...state.projects, project],
  });
}

export function selectRepositoryProject(
  stateValue: ProjectRepositoryState,
  projectId: string,
): ProjectRepositoryState {
  const state = parseProjectRepository(stateValue);
  if (!state.projects.some(({ id }) => id === projectId)) {
    throw new Error(`Project ${projectId} does not exist.`);
  }
  return { ...state, activeProjectId: projectId };
}

export function removeRepositoryProject(
  stateValue: ProjectRepositoryState,
  projectId: string,
): ProjectRepositoryState {
  const state = parseProjectRepository(stateValue);
  const projects = state.projects.filter(({ id }) => id !== projectId);
  if (projects.length === state.projects.length) return state;
  return parseProjectRepository({
    ...state,
    activeProjectId: state.activeProjectId === projectId
      ? projects.at(-1)?.id ?? null
      : state.activeProjectId,
    projects,
  });
}

function cloneImportedProject(
  source: KingxfordProject,
  importedAt: string,
  occupiedIds: ReadonlySet<string>,
) {
  let attempt = 0;
  let projectId = stableEntityId("project", "import-clone", source.id, importedAt, attempt);
  while (occupiedIds.has(projectId)) {
    attempt += 1;
    projectId = stableEntityId("project", "import-clone", source.id, importedAt, attempt);
  }
  const artifactIds = new Map(source.artifacts.map(({ id }) => [
    id,
    stableEntityId("artifact", projectId, id),
  ]));
  const revisionIds = new Map(source.revisions.map(({ id }) => [
    id,
    stableEntityId("revision", projectId, id),
  ]));
  const gateIds = new Map(source.gates.map(({ id }) => [
    id,
    stableEntityId("gate", projectId, id),
  ]));
  const decisionIds = new Map(source.decisions.map(({ id }) => [
    id,
    stableEntityId("decision", projectId, id),
  ]));
  const reviewIds = new Map(source.reviewLinks.map(({ id }) => [
    id,
    stableEntityId("review", projectId, id),
  ]));
  const nodeIds = new Map(source.nodes.map(({ id }) => [
    id,
    stableEntityId("node", projectId, id),
  ]));

  const revisions: ProjectRevision[] = source.revisions.map((revision) => ({
    ...revision,
    id: revisionIds.get(revision.id)!,
    artifactId: artifactIds.get(revision.artifactId)!,
    parentRevisionId: revision.parentRevisionId
      ? revisionIds.get(revision.parentRevisionId)!
      : null,
  }));
  const artifacts = source.artifacts.map((artifact) => ({
    ...artifact,
    id: artifactIds.get(artifact.id)!,
    activeRevisionId: revisionIds.get(artifact.activeRevisionId)!,
    revisionIds: artifact.revisionIds.map((id) => revisionIds.get(id)!),
  }));
  const gates: ProjectGate[] = source.gates.map((gate) => ({
    ...gate,
    id: gateIds.get(gate.id)!,
    decisionId: gate.decisionId ? decisionIds.get(gate.decisionId)! : null,
    supportedEvidenceArtifactIds: gate.supportedEvidenceArtifactIds.map(
      (id) => artifactIds.get(id)!,
    ),
  }));
  const decisions: ProjectDecision[] = source.decisions.map((decision) => ({
    ...decision,
    id: decisionIds.get(decision.id)!,
    gateId: gateIds.get(decision.gateId)!,
    evidenceArtifactIds: decision.evidenceArtifactIds.map((id) => artifactIds.get(id)!),
  }));
  const reviewLinks: ProjectReviewLink[] = source.reviewLinks.map((review) => ({
    ...review,
    id: reviewIds.get(review.id)!,
    artifactId: artifactIds.get(review.artifactId)!,
    revisionId: revisionIds.get(review.revisionId)!,
    // snapshotId/hash intentionally remain the immutable source-review provenance.
  }));
  const nodes: ProjectNode[] = source.nodes.map((node) => {
    const id = nodeIds.get(node.id)!;
    const structuralRef = node.kind === "artifact"
      ? artifactIds.get(node.refId)
      : node.kind === "revision"
        ? revisionIds.get(node.refId)
        : node.kind === "gate"
          ? gateIds.get(node.refId)
          : node.kind === "decision"
            ? decisionIds.get(node.refId)
            : node.kind === "review"
              ? reviewIds.get(node.refId)
              : node.kind === "phase"
                ? node.refId
                : id;
    return { ...node, id, refId: structuralRef! };
  });
  const edges: ProjectEdge[] = source.edges.map((edge) => {
    const fromNodeId = nodeIds.get(edge.fromNodeId)!;
    const toNodeId = nodeIds.get(edge.toNodeId)!;
    return {
      ...edge,
      id: stableEntityId("edge", projectId, edge.id, fromNodeId, toNodeId),
      fromNodeId,
      toNodeId,
    };
  });
  const sourceSnapshotIds = Array.from(new Set([
    ...source.origin.sourceSnapshotIds,
    ...source.reviewLinks.map(({ snapshotId }) => snapshotId),
  ])).slice(0, 72);

  return parseKingxfordProject({
    ...source,
    id: projectId,
    title: `${source.title} · imported copy`.slice(0, 160),
    activeArtifactId: source.activeArtifactId
      ? artifactIds.get(source.activeArtifactId)!
      : null,
    updatedAt: importedAt,
    origin: {
      kind: "import-clone",
      sourceProjectId: source.id,
      sourceSnapshotIds,
      recordedAt: importedAt,
    },
    artifacts,
    revisions,
    nodes,
    edges,
    reviewLinks,
    decisions,
    gates,
  });
}

export type ImportProjectResult = Readonly<{
  state: ProjectRepositoryState;
  project: KingxfordProject;
  cloned: boolean;
}>;

export function importProject(
  stateValue: ProjectRepositoryState,
  value: unknown,
  importedAt = new Date().toISOString(),
): ImportProjectResult {
  const state = parseProjectRepository(stateValue);
  if (state.projects.length >= PROJECT_REPOSITORY_MAX_PROJECTS) {
    throw new Error(`Delete a project before importing; the local limit is ${PROJECT_REPOSITORY_MAX_PROJECTS}.`);
  }
  const source = parseKingxfordProject(value);
  const collision = state.projects.some(({ id }) => id === source.id);
  const project = collision
    ? cloneImportedProject(source, importedAt, new Set(state.projects.map(({ id }) => id)))
    : source;
  return {
    state: upsertRepositoryProject(state, project),
    project,
    cloned: collision,
  };
}

export function importProjectJson(
  state: ProjectRepositoryState,
  serialized: string,
  importedAt = new Date().toISOString(),
) {
  if (new TextEncoder().encode(serialized).byteLength > PROJECT_REPOSITORY_MAX_BYTES) {
    throw new Error("Imported project file exceeds the local safety boundary.");
  }
  return importProject(state, JSON.parse(serialized), importedAt);
}

export function exportProjectJson(projectValue: KingxfordProject) {
  return JSON.stringify(parseKingxfordProject(projectValue), null, 2);
}

export function activeRepositoryProject(stateValue: ProjectRepositoryState) {
  const state = parseProjectRepository(stateValue);
  return state.projects.find(({ id }) => id === state.activeProjectId) ?? null;
}

export function isKingxfordProject(value: unknown): value is KingxfordProject {
  return safeParseKingxfordProject(value).success;
}
