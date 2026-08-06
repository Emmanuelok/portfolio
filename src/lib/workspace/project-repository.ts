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
import { readUnifiedCreateSystemProjects } from "./unified-migration";

export const PROJECT_REPOSITORY_STORAGE_KEY = "kingxford:projects:v2" as const;
export const PROJECT_REPOSITORY_CHANGE_EVENT =
  "kingxford:project-repository-change" as const;
export const PROJECT_REPOSITORY_SCHEMA_VERSION = 2 as const;
export const PROJECT_REPOSITORY_MAX_PROJECTS = 20 as const;
export const PROJECT_REPOSITORY_MAX_BYTES = 4_500_000 as const;

export type ProjectRepositoryChangeDetail = Readonly<{
  activeProjectId: string | null;
  projectCount: number;
}>;

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

function isBrowserLocalStorage(storage: ProjectStorage) {
  if (typeof window === "undefined") return false;
  try {
    return storage === window.localStorage;
  } catch {
    return false;
  }
}

/**
 * `storage` does not fire in the tab that performed a write. This bounded,
 * content-free event lets public continuity surfaces refresh without exposing
 * project source through an event payload.
 */
export function dispatchProjectRepositoryChange(
  stateValue: ProjectRepositoryState,
) {
  if (typeof window === "undefined") return;
  const state = parseProjectRepository(stateValue);
  const detail: ProjectRepositoryChangeDetail = {
    activeProjectId: state.activeProjectId,
    projectCount: state.projects.length,
  };
  const target = window;
  target.queueMicrotask(() => {
    target.dispatchEvent(new CustomEvent<ProjectRepositoryChangeDetail>(
      PROJECT_REPOSITORY_CHANGE_EVENT,
      { detail },
    ));
  });
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
  let baseState: ProjectRepositoryState;
  if (stored) {
    if (new TextEncoder().encode(stored).byteLength > PROJECT_REPOSITORY_MAX_BYTES) {
      throw new Error("Stored project repository exceeds its safety boundary.");
    }
    baseState = parseProjectRepository(JSON.parse(stored));
  } else {
    const legacy = storage.getItem(CANVAS_V1_STORAGE_KEY);
    const migrated = legacy
      ? tryMigrateCanvasV1ToProject(JSON.parse(legacy))
      : null;
    baseState = migrated
      ? upsertRepositoryProject(createEmptyProjectRepository(), migrated)
      : createEmptyProjectRepository();
  }

  // Import the first unified-platform library transactionally. Deterministic
  // migration IDs make this idempotent; the legacy keys remain untouched for
  // recovery. Any invalid or over-capacity migration leaves Atlas intact.
  try {
    const migration = readUnifiedCreateSystemProjects(
      storage,
      new Set(baseState.projects.map(({ id }) => id)),
    );
    if (migration.warnings.length > 0) return baseState;
    if (migration.projects.length === 0) {
      if (!stored && baseState.projects.length > 0) {
        saveProjectRepository(baseState, storage);
      }
      return baseState;
    }
    if (
      baseState.projects.length + migration.projects.length
      > PROJECT_REPOSITORY_MAX_PROJECTS
    ) {
      return baseState;
    }
    const merged = parseProjectRepository({
      ...baseState,
      activeProjectId: baseState.activeProjectId
        ?? migration.projects.at(-1)?.id
        ?? null,
      projects: [...baseState.projects, ...migration.projects],
    });
    saveProjectRepository(merged, storage);
    return merged;
  } catch {
    return baseState;
  }
}

export function saveProjectRepository(
  state: ProjectRepositoryState,
  storage: ProjectStorage | null = getDefaultStorage(),
) {
  if (!storage) return state;
  const validated = parseProjectRepository(state);
  storage.setItem(
    PROJECT_REPOSITORY_STORAGE_KEY,
    serializeProjectRepository(validated),
  );
  if (isBrowserLocalStorage(storage)) {
    dispatchProjectRepositoryChange(validated);
  }
  return validated;
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

type RepositoryCloneReason = "duplicate" | "import";

function allocateRemappedIds(
  namespace: string,
  projectId: string,
  sourceIds: readonly string[],
) {
  const allocated = new Set<string>();
  return new Map(sourceIds.map((sourceId) => {
    let attempt = 0;
    let nextId = stableEntityId(namespace, projectId, sourceId, attempt);
    while (allocated.has(nextId)) {
      attempt += 1;
      nextId = stableEntityId(namespace, projectId, sourceId, attempt);
    }
    allocated.add(nextId);
    return [sourceId, nextId] as const;
  }));
}

function cloneTitle(title: string, reason: RepositoryCloneReason) {
  const suffix = reason === "duplicate" ? " · copy" : " · imported copy";
  return `${title.slice(0, 160 - suffix.length).trimEnd()}${suffix}`;
}

function cloneProjectForRepository(
  source: KingxfordProject,
  clonedAt: string,
  occupiedIds: ReadonlySet<string>,
  reason: RepositoryCloneReason,
) {
  let attempt = 0;
  let projectId = stableEntityId("project", reason, source.id, clonedAt, attempt);
  while (occupiedIds.has(projectId)) {
    attempt += 1;
    projectId = stableEntityId("project", reason, source.id, clonedAt, attempt);
  }
  const artifactIds = allocateRemappedIds(
    "artifact",
    projectId,
    source.artifacts.map(({ id }) => id),
  );
  const revisionIds = allocateRemappedIds(
    "revision",
    projectId,
    source.revisions.map(({ id }) => id),
  );
  const gateIds = allocateRemappedIds(
    "gate",
    projectId,
    source.gates.map(({ id }) => id),
  );
  const decisionIds = allocateRemappedIds(
    "decision",
    projectId,
    source.decisions.map(({ id }) => id),
  );
  const reviewIds = allocateRemappedIds(
    "review",
    projectId,
    source.reviewLinks.map(({ id }) => id),
  );
  const nodeIds = allocateRemappedIds(
    "node",
    projectId,
    source.nodes.map(({ id }) => id),
  );
  const edgeIds = allocateRemappedIds(
    "edge",
    projectId,
    source.edges.map(({ id }) => id),
  );
  const remapStructuralReference = (reference: string | null) => {
    if (reference === null) return null;
    return artifactIds.get(reference)
      ?? revisionIds.get(reference)
      ?? gateIds.get(reference)
      ?? decisionIds.get(reference)
      ?? reviewIds.get(reference)
      ?? nodeIds.get(reference)
      ?? reference;
  };

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
    return {
      ...node,
      id,
      refId: structuralRef!,
      sourceRef: remapStructuralReference(node.sourceRef),
    };
  });
  const edges: ProjectEdge[] = source.edges.map((edge) => {
    const fromNodeId = nodeIds.get(edge.fromNodeId)!;
    const toNodeId = nodeIds.get(edge.toNodeId)!;
    return {
      ...edge,
      id: edgeIds.get(edge.id)!,
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
    title: cloneTitle(source.title, reason),
    activeArtifactId: source.activeArtifactId
      ? artifactIds.get(source.activeArtifactId)!
      : null,
    updatedAt: clonedAt,
    origin: {
      kind: "import-clone",
      sourceProjectId: source.id,
      sourceSnapshotIds,
      recordedAt: clonedAt,
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

export type DuplicateProjectResult = Readonly<{
  state: ProjectRepositoryState;
  project: KingxfordProject;
}>;

export function duplicateRepositoryProject(
  stateValue: ProjectRepositoryState,
  projectId: string,
  duplicatedAt = new Date().toISOString(),
): DuplicateProjectResult {
  const state = parseProjectRepository(stateValue);
  if (state.projects.length >= PROJECT_REPOSITORY_MAX_PROJECTS) {
    throw new Error(
      `Delete a project before duplicating; the local limit is ${PROJECT_REPOSITORY_MAX_PROJECTS}.`,
    );
  }
  const source = state.projects.find(({ id }) => id === projectId);
  if (!source) throw new Error(`Project ${projectId} does not exist.`);
  const project = cloneProjectForRepository(
    source,
    duplicatedAt,
    new Set(state.projects.map(({ id }) => id)),
    "duplicate",
  );
  return {
    state: upsertRepositoryProject(state, project),
    project,
  };
}

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
    ? cloneProjectForRepository(
        source,
        importedAt,
        new Set(state.projects.map(({ id }) => id)),
        "import",
      )
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
