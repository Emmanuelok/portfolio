import {
  cloudEvidenceDownloadPath,
  isCloudEvidenceWritableRole,
  type CloudEvidenceObject,
} from "./evidence-contracts";
import {
  CloudClientError,
  createCloudIdempotencyKey,
} from "./client-sync";
import type { CloudRole } from "./contracts";
import {
  setActiveCloudOrganization,
  withActiveCloudOrganization,
} from "./organization-selection";

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type JsonRecord = Record<string, unknown>;

export type CloudEvidenceIndex = Readonly<{
  organizationId: string;
  projectId: string;
  role: CloudRole;
  canWrite: boolean;
  evidence: readonly CloudEvidenceObject[];
}>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function invalidResponse(message: string): never {
  throw new CloudClientError(502, "invalid_cloud_response", message);
}

async function readResponse(response: Response) {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CloudClientError(
      response.status,
      "invalid_cloud_response",
      "The evidence service returned an unreadable response.",
    );
  }
  const record = asRecord(body);
  if (!record) invalidResponse("The evidence service returned an invalid response.");
  if (!response.ok) {
    const error = asRecord(record.error);
    throw new CloudClientError(
      response.status,
      typeof error?.code === "string" ? error.code : "cloud_evidence_request_failed",
      typeof error?.message === "string"
        ? error.message
        : "The cloud evidence request could not be completed.",
      error?.details,
    );
  }
  return record;
}

function parseEvidence(value: unknown): CloudEvidenceObject {
  const record = asRecord(value);
  if (
    !record
    || typeof record.id !== "string"
    || typeof record.projectId !== "string"
    || (record.artifactId !== null && typeof record.artifactId !== "string")
    || typeof record.filename !== "string"
    || typeof record.mimeType !== "string"
    || typeof record.byteSize !== "number"
    || !Number.isSafeInteger(record.byteSize)
    || record.byteSize < 1
    || typeof record.sha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(record.sha256)
    || typeof record.createdAt !== "string"
    || Number.isNaN(Date.parse(record.createdAt))
    || typeof record.deletionPending !== "boolean"
  ) {
    invalidResponse("A retained evidence record failed validation.");
  }
  return {
    id: record.id,
    projectId: record.projectId,
    artifactId: record.artifactId,
    filename: record.filename,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    sha256: record.sha256,
    createdAt: record.createdAt,
    deletionPending: record.deletionPending,
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

export async function fetchCloudEvidenceIndex(
  projectId: string,
  fetcher: FetchLike = fetch,
): Promise<CloudEvidenceIndex> {
  const response = await fetcher(
    `/api/cloud/projects/${encodeURIComponent(projectId)}/evidence`,
    requestDefaults(),
  );
  const record = await readResponse(response);
  if (
    typeof record.organizationId !== "string"
    || record.projectId !== projectId
    || typeof record.role !== "string"
    || !["owner", "admin", "editor", "reviewer", "viewer"].includes(record.role)
    || !Array.isArray(record.evidence)
  ) {
    invalidResponse("The retained evidence index failed validation.");
  }
  const role = record.role as CloudRole;
  const result = {
    organizationId: record.organizationId,
    projectId,
    role,
    canWrite: isCloudEvidenceWritableRole(role),
    evidence: record.evidence.map(parseEvidence),
  };
  setActiveCloudOrganization(result.organizationId);
  return result;
}

export async function retainCloudEvidence(
  projectId: string,
  file: File,
  artifactId: string | null,
  fetcher: FetchLike = fetch,
) {
  const form = new FormData();
  form.set("file", file);
  if (artifactId) form.set("artifactId", artifactId);
  const response = await fetcher(
    `/api/cloud/projects/${encodeURIComponent(projectId)}/evidence`,
    requestDefaults({
      method: "POST",
      headers: {
        "Idempotency-Key": createCloudIdempotencyKey("evidence-retain", projectId),
      },
      body: form,
    }),
  );
  const record = await readResponse(response);
  return parseEvidence(record.evidence);
}

export async function deleteCloudEvidence(
  projectId: string,
  evidenceId: string,
  fetcher: FetchLike = fetch,
) {
  const response = await fetcher(
    cloudEvidenceDownloadPath(projectId, evidenceId),
    requestDefaults({
      method: "DELETE",
      headers: {
        "Idempotency-Key": createCloudIdempotencyKey("evidence-delete", evidenceId),
      },
    }),
  );
  await readResponse(response);
}
