import {
  platformAgentRoles,
  platformAgentRunSources,
  platformArtifactRelations,
  platformDecisionStatuses,
  platformEvidenceKinds,
  isLegacyPlatformPhase,
  normalizePlatformPhase,
  platformPhases,
  type PlatformAcceptedAgentRun,
  type PlatformArtifactRelationship,
  type PlatformChangeDetail,
  type PlatformDecision,
  type PlatformEvidenceReference,
  type PlatformMapViewState,
  type PlatformPoint,
  type PlatformProjectIntelligence,
  type PlatformSidecarV1,
} from "@/lib/platform/types";

export const PLATFORM_STORAGE_KEY = "kingxford:platform:v1";
export const PLATFORM_SCHEMA_VERSION = 1 as const;
export const PLATFORM_CHANGE_EVENT = "kingxford:platform-change";

export const PLATFORM_PROJECT_LIMIT = 20;
export const PLATFORM_RELATIONSHIP_LIMIT = 256;
export const PLATFORM_EVIDENCE_LIMIT = 128;
export const PLATFORM_DECISION_LIMIT = 128;
export const PLATFORM_AGENT_RUN_LIMIT = 128;
export const PLATFORM_MAP_NODE_LIMIT = 512;
export const PLATFORM_STORAGE_CHARACTER_LIMIT = 1_000_000;

const IDENTIFIER_LIMIT = 200;
const OBJECTIVE_LIMIT = 6_000;
const TITLE_LIMIT = 240;
const LABEL_LIMIT = 400;
const SOURCE_LIMIT = 2_000;
const DETAIL_LIMIT = 4_000;
const MODEL_LIMIT = 200;
const PROTOCOL_LIMIT = 200;
const AGENT_SUMMARY_LIMIT = 2_000;
const RELATED_ARTIFACT_LIMIT = 32;
const COORDINATE_LIMIT = 1_000_000;
const MIN_MAP_ZOOM = 0.25;
const MAX_MAP_ZOOM = 3;

export type PlatformStorageErrorCode =
  | "invalid-json"
  | "invalid-data"
  | "unsupported-version"
  | "too-large"
  | "project-limit"
  | "quota-exceeded"
  | "storage-unavailable";

export class PlatformStorageError extends Error {
  readonly code: PlatformStorageErrorCode;

  constructor(
    code: PlatformStorageErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PlatformStorageError";
    this.code = code;
  }
}

export type PlatformStorageLike = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}>;

export type PlatformLoadResult =
  | Readonly<{ status: "ready"; sidecar: PlatformSidecarV1 }>
  | Readonly<{ status: "empty"; sidecar: PlatformSidecarV1 }>
  | Readonly<{ status: "error"; error: PlatformStorageError }>;

export type PlatformSaveResult =
  | Readonly<{ ok: true; serializedCharacters: number }>
  | Readonly<{ ok: false; error: PlatformStorageError }>;

type UnknownRecord = Record<string, unknown>;

function invalid(path: string, message: string): never {
  throw new PlatformStorageError(
    "invalid-data",
    `Platform intelligence data is invalid at ${path}: ${message}`,
  );
}

function asRecord(value: unknown, path: string): UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid(path, "expected an object.");
  }
  return value as UnknownRecord;
}

function strictRecord(
  value: unknown,
  path: string,
  expectedKeys: readonly string[],
): UnknownRecord {
  const record = asRecord(value, path);
  const actualKeys = Object.keys(record);
  const unexpected = actualKeys.find((key) => !expectedKeys.includes(key));
  const missing = expectedKeys.find((key) => !(key in record));
  if (unexpected) invalid(path, `unexpected field '${unexpected}'.`);
  if (missing) invalid(path, `missing field '${missing}'.`);
  return record;
}

function boundedString(
  value: unknown,
  path: string,
  maximum: number,
  options: Readonly<{ empty?: boolean }> = {},
) {
  if (typeof value !== "string") invalid(path, "expected text.");
  if (!options.empty && value.trim().length === 0) {
    invalid(path, "text cannot be empty.");
  }
  if (value.length > maximum) {
    invalid(path, `text exceeds ${maximum.toLocaleString()} characters.`);
  }
  return value;
}

function identifier(value: unknown, path: string) {
  const result = boundedString(value, path, IDENTIFIER_LIMIT);
  if (
    result !== result.trim() ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(result)
  ) {
    invalid(path, "expected a stable identifier.");
  }
  return result;
}

function timestamp(value: unknown, path: string) {
  const result = boundedString(value, path, 64);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(result) ||
    Number.isNaN(Date.parse(result))
  ) {
    invalid(path, "expected an ISO-8601 timestamp with a timezone.");
  }
  return result;
}

function enumValue<T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: T,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    invalid(path, `expected one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

function phaseValue(value: unknown, path: string) {
  const phase = normalizePlatformPhase(value);
  if (!phase) {
    invalid(path, `expected one of: ${platformPhases.join(", ")}.`);
  }
  return phase;
}

function boundedArray(value: unknown, path: string, maximum: number) {
  if (!Array.isArray(value)) invalid(path, "expected a list.");
  if (value.length > maximum) {
    invalid(path, `list exceeds ${maximum.toLocaleString()} entries.`);
  }
  return value;
}

function uniqueIdentifiers(value: unknown, path: string, maximum: number) {
  const items = boundedArray(value, path, maximum).map((item, index) =>
    identifier(item, `${path}[${index}]`),
  );
  if (new Set(items).size !== items.length) {
    invalid(path, "identifiers must be unique.");
  }
  return items;
}

function point(value: unknown, path: string): PlatformPoint {
  const record = strictRecord(value, path, ["x", "y"]);
  const coordinate = (candidate: unknown, coordinatePath: string) => {
    if (
      typeof candidate !== "number" ||
      !Number.isFinite(candidate) ||
      Math.abs(candidate) > COORDINATE_LIMIT
    ) {
      invalid(
        coordinatePath,
        `expected a finite coordinate within ±${COORDINATE_LIMIT.toLocaleString()}.`,
      );
    }
    return candidate;
  };
  return {
    x: coordinate(record.x, `${path}.x`),
    y: coordinate(record.y, `${path}.y`),
  };
}

function mapView(value: unknown, path: string): PlatformMapViewState | null {
  if (value === null) return null;
  const record = strictRecord(value, path, ["zoom", "pan", "nodeOffsets"]);
  if (
    typeof record.zoom !== "number" ||
    !Number.isFinite(record.zoom) ||
    record.zoom < MIN_MAP_ZOOM ||
    record.zoom > MAX_MAP_ZOOM
  ) {
    invalid(path, `zoom must be between ${MIN_MAP_ZOOM} and ${MAX_MAP_ZOOM}.`);
  }
  const rawOffsets = asRecord(record.nodeOffsets, `${path}.nodeOffsets`);
  const entries = Object.entries(rawOffsets);
  if (entries.length > PLATFORM_MAP_NODE_LIMIT) {
    invalid(
      `${path}.nodeOffsets`,
      `map layout exceeds ${PLATFORM_MAP_NODE_LIMIT} nodes.`,
    );
  }
  const nodeOffsets: Record<string, PlatformPoint> = Object.create(null) as Record<
    string,
    PlatformPoint
  >;
  for (const [nodeId, rawPoint] of entries) {
    const safeNodeId = identifier(nodeId, `${path}.nodeOffsets key`);
    nodeOffsets[safeNodeId] = point(
      rawPoint,
      `${path}.nodeOffsets.${safeNodeId}`,
    );
  }
  return {
    zoom: record.zoom,
    pan: point(record.pan, `${path}.pan`),
    nodeOffsets,
  };
}

function artifactRelationship(
  value: unknown,
  path: string,
): PlatformArtifactRelationship {
  const record = strictRecord(value, path, [
    "id",
    "fromArtifactId",
    "toArtifactId",
    "relation",
    "label",
    "createdAt",
  ]);
  const fromArtifactId = identifier(
    record.fromArtifactId,
    `${path}.fromArtifactId`,
  );
  const toArtifactId = identifier(record.toArtifactId, `${path}.toArtifactId`);
  if (fromArtifactId === toArtifactId) {
    invalid(path, "an artifact cannot be related to itself.");
  }
  return {
    id: identifier(record.id, `${path}.id`),
    fromArtifactId,
    toArtifactId,
    relation: enumValue(
      record.relation,
      `${path}.relation`,
      platformArtifactRelations,
    ),
    label: boundedString(record.label, `${path}.label`, LABEL_LIMIT, {
      empty: true,
    }),
    createdAt: timestamp(record.createdAt, `${path}.createdAt`),
  };
}

function evidenceReference(
  value: unknown,
  path: string,
): PlatformEvidenceReference {
  const record = strictRecord(value, path, [
    "id",
    "kind",
    "title",
    "source",
    "claim",
    "addedAt",
  ]);
  const kind = enumValue(record.kind, `${path}.kind`, platformEvidenceKinds);
  const source = boundedString(record.source, `${path}.source`, SOURCE_LIMIT);
  if (kind === "url") {
    try {
      const parsed = new URL(source);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        invalid(`${path}.source`, "URL evidence must use HTTP or HTTPS.");
      }
    } catch (error) {
      if (error instanceof PlatformStorageError) throw error;
      invalid(`${path}.source`, "expected a complete HTTP or HTTPS URL.");
    }
  }
  return {
    id: identifier(record.id, `${path}.id`),
    kind,
    title: boundedString(record.title, `${path}.title`, TITLE_LIMIT),
    source,
    claim: boundedString(record.claim, `${path}.claim`, DETAIL_LIMIT, {
      empty: true,
    }),
    addedAt: timestamp(record.addedAt, `${path}.addedAt`),
  };
}

function decision(value: unknown, path: string): PlatformDecision {
  const record = strictRecord(value, path, [
    "id",
    "title",
    "decision",
    "rationale",
    "status",
    "relatedArtifactIds",
    "createdAt",
  ]);
  return {
    id: identifier(record.id, `${path}.id`),
    title: boundedString(record.title, `${path}.title`, TITLE_LIMIT),
    decision: boundedString(record.decision, `${path}.decision`, DETAIL_LIMIT),
    rationale: boundedString(
      record.rationale,
      `${path}.rationale`,
      DETAIL_LIMIT,
      { empty: true },
    ),
    status: enumValue(
      record.status,
      `${path}.status`,
      platformDecisionStatuses,
    ),
    relatedArtifactIds: uniqueIdentifiers(
      record.relatedArtifactIds,
      `${path}.relatedArtifactIds`,
      RELATED_ARTIFACT_LIMIT,
    ),
    createdAt: timestamp(record.createdAt, `${path}.createdAt`),
  };
}

function acceptedAgentRun(
  value: unknown,
  path: string,
): PlatformAcceptedAgentRun {
  const record = strictRecord(value, path, [
    "id",
    "role",
    "phase",
    "source",
    "model",
    "protocolVersion",
    "inputDigest",
    "summary",
    "artifactIds",
    "acceptedAt",
  ]);
  const inputDigest = boundedString(
    record.inputDigest,
    `${path}.inputDigest`,
    64,
  );
  if (!/^[a-f0-9]{64}$/i.test(inputDigest)) {
    invalid(`${path}.inputDigest`, "expected a SHA-256 digest.");
  }
  return {
    id: identifier(record.id, `${path}.id`),
    role: enumValue(record.role, `${path}.role`, platformAgentRoles),
    phase: phaseValue(record.phase, `${path}.phase`),
    source: enumValue(
      record.source,
      `${path}.source`,
      platformAgentRunSources,
    ),
    model: boundedString(record.model, `${path}.model`, MODEL_LIMIT),
    protocolVersion: boundedString(
      record.protocolVersion,
      `${path}.protocolVersion`,
      PROTOCOL_LIMIT,
    ),
    inputDigest: inputDigest.toLowerCase(),
    summary: boundedString(
      record.summary,
      `${path}.summary`,
      AGENT_SUMMARY_LIMIT,
    ),
    artifactIds: uniqueIdentifiers(
      record.artifactIds,
      `${path}.artifactIds`,
      RELATED_ARTIFACT_LIMIT,
    ),
    acceptedAt: timestamp(record.acceptedAt, `${path}.acceptedAt`),
  };
}

function validateUniqueEntryIds(
  entries: readonly Readonly<{ id: string }>[],
  path: string,
) {
  const ids = entries.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) {
    invalid(path, "entry identifiers must be unique.");
  }
}

function projectIntelligence(
  value: unknown,
  path: string,
  expectedProjectId?: string,
): PlatformProjectIntelligence {
  const record = strictRecord(value, path, [
    "projectId",
    "objective",
    "phase",
    "artifactRelationships",
    "evidence",
    "decisions",
    "agentRuns",
    "mapView",
    "updatedAt",
  ]);
  const projectId = identifier(record.projectId, `${path}.projectId`);
  if (expectedProjectId && projectId !== expectedProjectId) {
    invalid(`${path}.projectId`, "must match its project dictionary key.");
  }
  const artifactRelationships = boundedArray(
    record.artifactRelationships,
    `${path}.artifactRelationships`,
    PLATFORM_RELATIONSHIP_LIMIT,
  ).map((item, index) =>
    artifactRelationship(item, `${path}.artifactRelationships[${index}]`),
  );
  const evidence = boundedArray(
    record.evidence,
    `${path}.evidence`,
    PLATFORM_EVIDENCE_LIMIT,
  ).map((item, index) => evidenceReference(item, `${path}.evidence[${index}]`));
  const decisions = boundedArray(
    record.decisions,
    `${path}.decisions`,
    PLATFORM_DECISION_LIMIT,
  ).map((item, index) => decision(item, `${path}.decisions[${index}]`));
  const agentRuns = boundedArray(
    record.agentRuns,
    `${path}.agentRuns`,
    PLATFORM_AGENT_RUN_LIMIT,
  ).map((item, index) => acceptedAgentRun(item, `${path}.agentRuns[${index}]`));

  validateUniqueEntryIds(artifactRelationships, `${path}.artifactRelationships`);
  validateUniqueEntryIds(evidence, `${path}.evidence`);
  validateUniqueEntryIds(decisions, `${path}.decisions`);
  validateUniqueEntryIds(agentRuns, `${path}.agentRuns`);

  return {
    projectId,
    objective: boundedString(
      record.objective,
      `${path}.objective`,
      OBJECTIVE_LIMIT,
      { empty: true },
    ),
    phase: phaseValue(record.phase, `${path}.phase`),
    artifactRelationships,
    evidence,
    decisions,
    agentRuns,
    mapView: mapView(record.mapView, `${path}.mapView`),
    updatedAt: timestamp(record.updatedAt, `${path}.updatedAt`),
  };
}

function sidecar(value: unknown): PlatformSidecarV1 {
  const record = strictRecord(value, "root", [
    "schemaVersion",
    "revision",
    "projects",
  ]);
  if (record.schemaVersion !== PLATFORM_SCHEMA_VERSION) {
    throw new PlatformStorageError(
      "unsupported-version",
      "This project intelligence library was created by an unsupported format version.",
    );
  }
  if (
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0
  ) {
    invalid("root.revision", "expected a non-negative safe integer.");
  }
  const rawProjects = asRecord(record.projects, "root.projects");
  const projectEntries = Object.entries(rawProjects);
  if (projectEntries.length > PLATFORM_PROJECT_LIMIT) {
    invalid(
      "root.projects",
      `library exceeds ${PLATFORM_PROJECT_LIMIT} projects.`,
    );
  }
  const projects: Record<string, PlatformProjectIntelligence> = Object.create(
    null,
  ) as Record<string, PlatformProjectIntelligence>;
  for (const [rawProjectId, value] of projectEntries) {
    const projectId = identifier(rawProjectId, "root.projects key");
    projects[projectId] = projectIntelligence(
      value,
      `root.projects.${projectId}`,
      projectId,
    );
  }
  return {
    schemaVersion: PLATFORM_SCHEMA_VERSION,
    revision: record.revision,
    projects,
  };
}

function containsLegacyPhaseAlias(value: unknown) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const projects = (value as UnknownRecord).projects;
  if (projects === null || typeof projects !== "object" || Array.isArray(projects)) {
    return false;
  }
  return Object.values(projects as UnknownRecord).some((projectValue) => {
    if (
      projectValue === null ||
      typeof projectValue !== "object" ||
      Array.isArray(projectValue)
    ) {
      return false;
    }
    const project = projectValue as UnknownRecord;
    if (isLegacyPlatformPhase(project.phase)) return true;
    return (
      Array.isArray(project.agentRuns) &&
      project.agentRuns.some(
        (run) =>
          run !== null &&
          typeof run === "object" &&
          !Array.isArray(run) &&
          isLegacyPlatformPhase((run as UnknownRecord).phase),
      )
    );
  });
}

function parseJson(raw: string): unknown {
  if (raw.length > PLATFORM_STORAGE_CHARACTER_LIMIT) {
    throw new PlatformStorageError(
      "too-large",
      "The project intelligence library exceeds the supported local size limit.",
    );
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new PlatformStorageError(
      "invalid-json",
      "The project intelligence library is not valid JSON.",
      { cause: error },
    );
  }
}

function asStorageError(error: unknown): PlatformStorageError {
  if (error instanceof PlatformStorageError) return error;
  const name =
    error !== null && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") {
    return new PlatformStorageError(
      "quota-exceeded",
      "This device has no remaining browser storage for project intelligence.",
      { cause: error },
    );
  }
  return new PlatformStorageError(
    "storage-unavailable",
    "Project intelligence storage is unavailable in this browser context.",
    { cause: error },
  );
}

export function createEmptyPlatformSidecar(): PlatformSidecarV1 {
  return {
    schemaVersion: PLATFORM_SCHEMA_VERSION,
    revision: 0,
    projects: Object.create(null) as Record<
      string,
      PlatformProjectIntelligence
    >,
  };
}

export function createPlatformProjectIntelligence(
  projectId: string,
  options: Readonly<{
    objective?: string;
    phase?: PlatformProjectIntelligence["phase"];
    now?: string;
  }> = {},
): PlatformProjectIntelligence {
  const value: PlatformProjectIntelligence = {
    projectId,
    objective: options.objective ?? "",
    phase: options.phase ?? "discovery",
    artifactRelationships: [],
    evidence: [],
    decisions: [],
    agentRuns: [],
    mapView: null,
    updatedAt: options.now ?? new Date().toISOString(),
  };
  return projectIntelligence(value, "project");
}

export function validatePlatformSidecar(value: unknown): PlatformSidecarV1 {
  return sidecar(value);
}

export function parsePlatformSidecar(raw: string): PlatformSidecarV1 {
  return sidecar(parseJson(raw));
}

export function serializePlatformSidecar(value: PlatformSidecarV1): string {
  const validated = sidecar(value);
  const serialized = JSON.stringify(validated);
  if (serialized.length > PLATFORM_STORAGE_CHARACTER_LIMIT) {
    throw new PlatformStorageError(
      "too-large",
      "The project intelligence library exceeds the supported local size limit.",
    );
  }
  return serialized;
}

export function loadPlatformSidecar(
  storage: PlatformStorageLike,
): PlatformLoadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(PLATFORM_STORAGE_KEY);
  } catch (error) {
    return { status: "error", error: asStorageError(error) };
  }
  if (raw === null) {
    return { status: "empty", sidecar: createEmptyPlatformSidecar() };
  }
  try {
    const rawValue = parseJson(raw);
    const parsedSidecar = sidecar(rawValue);
    if (containsLegacyPhaseAlias(rawValue)) {
      storage.setItem(PLATFORM_STORAGE_KEY, serializePlatformSidecar(parsedSidecar));
    }
    return { status: "ready", sidecar: parsedSidecar };
  } catch (error) {
    return { status: "error", error: asStorageError(error) };
  }
}

export function savePlatformSidecar(
  storage: PlatformStorageLike,
  value: PlatformSidecarV1,
): PlatformSaveResult {
  try {
    const serialized = serializePlatformSidecar(value);
    storage.setItem(PLATFORM_STORAGE_KEY, serialized);
    return { ok: true, serializedCharacters: serialized.length };
  } catch (error) {
    return { ok: false, error: asStorageError(error) };
  }
}

export function upsertPlatformProject(
  value: PlatformSidecarV1,
  project: PlatformProjectIntelligence,
): PlatformSidecarV1 {
  const current = sidecar(value);
  const nextProject = projectIntelligence(project, "project");
  const isNew = !(nextProject.projectId in current.projects);
  if (isNew && Object.keys(current.projects).length >= PLATFORM_PROJECT_LIMIT) {
    throw new PlatformStorageError(
      "project-limit",
      `Project intelligence supports up to ${PLATFORM_PROJECT_LIMIT} projects in this release.`,
    );
  }
  return sidecar({
    schemaVersion: PLATFORM_SCHEMA_VERSION,
    revision: current.revision + 1,
    projects: {
      ...current.projects,
      [nextProject.projectId]: nextProject,
    },
  });
}

export function removePlatformProject(
  value: PlatformSidecarV1,
  projectId: string,
): PlatformSidecarV1 {
  const current = sidecar(value);
  const safeProjectId = identifier(projectId, "projectId");
  if (!(safeProjectId in current.projects)) return current;
  const projects: Record<string, PlatformProjectIntelligence> = Object.create(
    null,
  ) as Record<string, PlatformProjectIntelligence>;
  for (const [id, project] of Object.entries(current.projects)) {
    if (id !== safeProjectId) projects[id] = project;
  }
  return sidecar({
    schemaVersion: PLATFORM_SCHEMA_VERSION,
    revision: current.revision + 1,
    projects,
  });
}

/**
 * localStorage emits `storage` only in other documents. Call this after a
 * successful save so components in the current tab can refresh as well.
 */
export function dispatchPlatformChange(detail: PlatformChangeDetail) {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function" ||
    typeof CustomEvent === "undefined"
  ) {
    return false;
  }
  if (
    !Number.isSafeInteger(detail.revision) ||
    detail.revision < 0
  ) {
    invalid("change.revision", "expected a non-negative safe integer.");
  }
  const checkedDetail: PlatformChangeDetail = {
    revision: detail.revision,
    projectId:
      detail.projectId === null
        ? null
        : identifier(detail.projectId, "change.projectId"),
    reason: enumValue(
      detail.reason,
      "change.reason",
      ["saved", "removed", "reloaded", "recovered"] as const,
    ),
  };
  window.dispatchEvent(
    new CustomEvent<PlatformChangeDetail>(PLATFORM_CHANGE_EVENT, {
      detail: checkedDetail,
    }),
  );
  return true;
}
