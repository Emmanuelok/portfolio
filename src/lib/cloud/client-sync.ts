import {
  formatCloudProjectEtag,
  isCloudRole,
  parseIdempotencyKey,
  parseOrganizationId,
  type CloudProjectSummary,
  type CloudRole,
} from "./contracts";
import {
  setActiveCloudOrganization,
  withActiveCloudOrganization,
} from "./organization-selection";
import {
  parseKingxfordProject,
  projectPhases,
  stableHash,
  type KingxfordProject,
} from "@/lib/workspace/project-graph";

export type CloudStatus = Readonly<{
  configured: boolean;
  authenticated: boolean;
  mode: "local-only" | "cloud-and-local";
  message: string;
}>;

export type CloudProjectIndex = Readonly<{
  organizationId: string;
  role: CloudRole;
  projects: readonly CloudProjectSummary[];
}>;

export type CloudProjectRecord = Readonly<{
  project: KingxfordProject;
  cloud: CloudProjectSummary;
}>;

export type CloudMutationResult = Readonly<{
  status: "created" | "updated" | "deleted" | "conflict";
  projectId: string;
  version: number | null;
  contentHash: string | null;
  replayed: boolean;
  updatedAt: string | null;
}>;

export type CloudSyncResult = Readonly<{
  ok: boolean;
  status: "synchronized" | "conflicts";
  results: readonly CloudMutationResult[];
}>;

export type CloudProjectRelationship =
  | "local-only"
  | "cloud-only"
  | "identical"
  | "local-newer"
  | "cloud-newer"
  | "diverged";

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type CloudDeletionKeyStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

type JsonRecord = Record<string, unknown>;

const accountDeletionKeyPrefix = "kingxford.cloud.account-deletion.v1";
const pendingAccountDeletionKeys = new Map<string, string>();

export class CloudClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "CloudClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function invalidResponse(message: string): never {
  throw new CloudClientError(502, "invalid_cloud_response", message);
}

async function readCloudResponse(response: Response) {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CloudClientError(
      response.status,
      "invalid_cloud_response",
      "The cloud service returned an unreadable response. Local projects were not changed.",
    );
  }

  const record = asRecord(body);
  if (!record) invalidResponse("The cloud service returned an invalid response. Local projects were not changed.");
  if (!response.ok) {
    const error = asRecord(record.error);
    throw new CloudClientError(
      response.status,
      typeof error?.code === "string" ? error.code : "cloud_request_failed",
      typeof error?.message === "string"
        ? error.message
        : "The cloud request could not be completed. Local projects were not changed.",
      error?.details,
    );
  }
  return record;
}

function parseCloudProjectSummary(value: unknown): CloudProjectSummary {
  const record = asRecord(value);
  if (
    !record
    || typeof record.id !== "string"
    || typeof record.title !== "string"
    || typeof record.summary !== "string"
    || typeof record.activePhase !== "string"
    || !projectPhases.includes(record.activePhase as KingxfordProject["activePhase"])
    || typeof record.version !== "number"
    || !Number.isSafeInteger(record.version)
    || record.version < 1
    || typeof record.contentHash !== "string"
    || typeof record.createdAt !== "string"
    || typeof record.updatedAt !== "string"
    || typeof record.etag !== "string"
  ) {
    invalidResponse("A cloud project summary failed validation.");
  }
  const expectedEtag = formatCloudProjectEtag(record.version, record.contentHash);
  if (record.etag !== expectedEtag || Number.isNaN(Date.parse(record.updatedAt))) {
    invalidResponse("A cloud project summary failed its version check.");
  }
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    activePhase: record.activePhase as KingxfordProject["activePhase"],
    version: record.version,
    contentHash: record.contentHash,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    etag: record.etag,
  };
}

function parseMutation(value: unknown): CloudMutationResult {
  const record = asRecord(value);
  const status = record?.status;
  if (
    !record
    || (status !== "created" && status !== "updated" && status !== "deleted" && status !== "conflict")
    || typeof record.projectId !== "string"
    || (record.version !== null && (
      typeof record.version !== "number"
      || !Number.isSafeInteger(record.version)
    ))
    || (record.contentHash !== null && typeof record.contentHash !== "string")
    || typeof record.replayed !== "boolean"
    || (record.updatedAt !== null && typeof record.updatedAt !== "string")
  ) {
    invalidResponse("A cloud mutation result failed validation.");
  }
  return {
    status,
    projectId: record.projectId,
    version: record.version,
    contentHash: record.contentHash,
    replayed: record.replayed,
    updatedAt: record.updatedAt,
  };
}

function requestDefaults(init: RequestInit = {}): RequestInit {
  const headers = withActiveCloudOrganization(init.headers);
  headers.set("Accept", "application/json");
  return {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers,
  };
}

export function createCloudIdempotencyKey(operation: string, subject = "account") {
  const safeOperation = operation.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 32);
  const safeSubject = subject.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(-48);
  let nonce: string;
  if (typeof globalThis.crypto?.randomUUID === "function") {
    nonce = globalThis.crypto.randomUUID();
  } else {
    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    nonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (/^0+$/.test(nonce)) {
      nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    }
  }
  return `kx.${safeOperation}.${safeSubject}.${nonce}`.slice(0, 160);
}

function browserDeletionKeyStorage(): CloudDeletionKeyStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function accountDeletionStorageKey(organizationId: string) {
  return `${accountDeletionKeyPrefix}:${organizationId}`;
}

function validStoredIdempotencyKey(value: string | null) {
  try {
    return parseIdempotencyKey(value);
  } catch {
    return null;
  }
}

function pendingAccountDeletionKey(
  organizationId: string,
  storage: CloudDeletionKeyStorage | null,
) {
  const storageKey = accountDeletionStorageKey(organizationId);
  if (storage) {
    try {
      const stored = validStoredIdempotencyKey(storage.getItem(storageKey));
      if (stored) {
        pendingAccountDeletionKeys.set(organizationId, stored);
        return stored;
      }
      storage.removeItem(storageKey);
    } catch {
      // Browser privacy settings and storage quotas must not block deletion.
    }
  }

  const inMemory = validStoredIdempotencyKey(
    pendingAccountDeletionKeys.get(organizationId) ?? null,
  );
  const key = inMemory ?? createCloudIdempotencyKey("account-delete", organizationId);
  pendingAccountDeletionKeys.set(organizationId, key);
  if (storage) {
    try {
      storage.setItem(storageKey, key);
    } catch {
      // The in-memory key still makes retries safe for the current page lifetime.
    }
  }
  return key;
}

function clearPendingAccountDeletionKey(
  organizationId: string,
  storage: CloudDeletionKeyStorage | null,
) {
  pendingAccountDeletionKeys.delete(organizationId);
  if (!storage) return;
  try {
    storage.removeItem(accountDeletionStorageKey(organizationId));
  } catch {
    // A completed deletion must not be reported as failed because storage is blocked.
  }
}

export function cloudProjectRelationship(
  local: KingxfordProject | null | undefined,
  cloud: CloudProjectSummary | null | undefined,
): CloudProjectRelationship {
  if (local && !cloud) return "local-only";
  if (!local && cloud) return "cloud-only";
  if (!local || !cloud) return "diverged";
  if (stableHash(local) === cloud.contentHash) return "identical";
  const localTime = Date.parse(local.updatedAt);
  const cloudTime = Date.parse(cloud.updatedAt);
  if (localTime > cloudTime) return "local-newer";
  if (cloudTime > localTime) return "cloud-newer";
  return "diverged";
}

export async function fetchCloudStatus(fetcher: FetchLike = fetch): Promise<CloudStatus> {
  const response = await fetcher("/api/cloud/status", requestDefaults());
  const record = await readCloudResponse(response);
  const cloud = asRecord(record.cloud);
  if (
    !cloud
    || typeof cloud.configured !== "boolean"
    || (cloud.mode !== "local-only" && cloud.mode !== "cloud-and-local")
    || typeof cloud.message !== "string"
    || typeof record.authenticated !== "boolean"
  ) {
    invalidResponse("The cloud status response failed validation.");
  }
  return {
    configured: cloud.configured,
    authenticated: record.authenticated,
    mode: cloud.mode,
    message: cloud.message,
  };
}

export async function fetchCloudProjectIndex(
  fetcher: FetchLike = fetch,
): Promise<CloudProjectIndex> {
  const response = await fetcher("/api/cloud/projects", requestDefaults());
  const record = await readCloudResponse(response);
  if (
    typeof record.organizationId !== "string"
    || !isCloudRole(record.role)
    || !Array.isArray(record.projects)
  ) {
    invalidResponse("The cloud project index failed validation.");
  }
  const result = {
    organizationId: record.organizationId,
    role: record.role,
    projects: record.projects.map(parseCloudProjectSummary),
  };
  setActiveCloudOrganization(result.organizationId);
  return result;
}

export async function fetchCloudProject(
  projectId: string,
  fetcher: FetchLike = fetch,
): Promise<CloudProjectRecord> {
  const response = await fetcher(
    `/api/cloud/projects/${encodeURIComponent(projectId)}`,
    requestDefaults(),
  );
  const record = await readCloudResponse(response);
  return {
    project: parseKingxfordProject(record.project),
    cloud: parseCloudProjectSummary(record.cloud),
  };
}

export async function uploadCloudProject(
  project: KingxfordProject,
  cloud: CloudProjectSummary | null,
  fetcher: FetchLike = fetch,
): Promise<CloudProjectRecord> {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Idempotency-Key": createCloudIdempotencyKey("project-upload", project.id),
  });
  if (cloud) headers.set("If-Match", cloud.etag);
  else headers.set("If-None-Match", "*");
  const response = await fetcher(`/api/cloud/projects/${encodeURIComponent(project.id)}`, requestDefaults({
    method: "PUT",
    headers,
    body: JSON.stringify({
      project,
      expectedVersion: cloud?.version ?? null,
    }),
  }));
  const record = await readCloudResponse(response);
  return {
    project: parseKingxfordProject(record.project),
    cloud: parseCloudProjectSummary(record.cloud),
  };
}

export async function synchronizeCloudProjects(
  projects: readonly KingxfordProject[],
  cloudProjects: readonly CloudProjectSummary[],
  fetcher: FetchLike = fetch,
): Promise<CloudSyncResult> {
  const remoteById = new Map(cloudProjects.map((project) => [project.id, project]));
  const response = await fetcher("/api/cloud/projects/sync", requestDefaults({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": createCloudIdempotencyKey("project-sync", `${projects.length}`),
    },
    body: JSON.stringify({
      projects: projects.map((project) => ({
        project,
        expectedVersion: remoteById.get(project.id)?.version ?? null,
      })),
    }),
  }));

  let record: JsonRecord;
  if (response.status === 409) {
    const body = await response.json() as unknown;
    const parsed = asRecord(body);
    if (!parsed || !Array.isArray(parsed.results)) {
      throw new CloudClientError(409, "project_sync_conflict", "One or more cloud projects changed before synchronization.");
    }
    record = parsed;
  } else {
    record = await readCloudResponse(response);
  }
  if (
    (record.status !== "synchronized" && record.status !== "conflicts")
    || !Array.isArray(record.results)
  ) {
    invalidResponse("The cloud synchronization result failed validation.");
  }
  return {
    ok: record.status === "synchronized",
    status: record.status,
    results: record.results.map(parseMutation),
  };
}

export async function deleteCloudAccountData(
  organizationId: string,
  fetcher: FetchLike = fetch,
  storage: CloudDeletionKeyStorage | null = browserDeletionKeyStorage(),
) {
  const normalizedOrganizationId = parseOrganizationId(organizationId);
  const idempotencyKey = pendingAccountDeletionKey(
    normalizedOrganizationId,
    storage,
  );
  const headers = withActiveCloudOrganization({
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  });
  headers.set("X-Kingxford-Organization-Id", normalizedOrganizationId);
  const response = await fetcher("/api/cloud/account", requestDefaults({
    method: "DELETE",
    headers,
    body: JSON.stringify({
      confirmation: "DELETE MY CLOUD DATA",
      organizationId: normalizedOrganizationId,
    }),
  }));
  const result = await readCloudResponse(response);
  clearPendingAccountDeletionKey(normalizedOrganizationId, storage);
  return result;
}
