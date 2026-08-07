import type { CloudRequestContext } from "./auth";
import {
  CLOUD_EVIDENCE_BUCKET,
  isCloudEvidenceWritableRole,
  type CloudEvidenceObject,
} from "./evidence-contracts";
import { CloudHttpError } from "./http";
import { getCloudProject } from "./repository";
import { createServiceCloudClient } from "./service";
import { verifyDownloadedEvidence } from "./evidence-validation";

type EvidenceRow = Readonly<{
  id: string;
  project_id: string;
  artifact_id: string | null;
  storage_path: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  sha256: string;
  created_at: string;
  deletion_requested_at: string | null;
}>;

export type CloudEvidenceRecord = Readonly<{
  evidence: CloudEvidenceObject;
  storagePath: string;
}>;

type RegisterEvidenceInput = Readonly<{
  projectId: string;
  artifactId: string | null;
  storagePath: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  idempotencyKey: string;
  requestHash: string;
}>;

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function privateEvidenceBucket() {
  const client = createServiceCloudClient();
  if (!client) {
    throw new CloudHttpError(
      503,
      "private_evidence_storage_not_configured",
      "Private evidence storage is not configured on this deployment.",
    );
  }
  return client.storage.from(CLOUD_EVIDENCE_BUCKET);
}

function parseEvidenceRow(value: unknown): EvidenceRow {
  const row = asRecord(value);
  if (
    !row
    || typeof row.id !== "string"
    || typeof row.project_id !== "string"
    || (row.artifact_id !== null && typeof row.artifact_id !== "string")
    || typeof row.storage_path !== "string"
    || typeof row.filename !== "string"
    || typeof row.mime_type !== "string"
    || typeof row.byte_size !== "number"
    || !Number.isSafeInteger(row.byte_size)
    || row.byte_size < 1
    || typeof row.sha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(row.sha256)
    || typeof row.created_at !== "string"
    || Number.isNaN(Date.parse(row.created_at))
    || (row.deletion_requested_at !== null && (
      typeof row.deletion_requested_at !== "string"
      || Number.isNaN(Date.parse(row.deletion_requested_at))
    ))
  ) {
    throw new CloudHttpError(
      502,
      "invalid_evidence_record",
      "A cloud evidence record failed its integrity check.",
    );
  }
  return {
    id: row.id,
    project_id: row.project_id,
    artifact_id: row.artifact_id,
    storage_path: row.storage_path,
    filename: row.filename,
    mime_type: row.mime_type,
    byte_size: row.byte_size,
    sha256: row.sha256,
    created_at: row.created_at,
    deletion_requested_at: row.deletion_requested_at,
  };
}

function evidenceFromRow(row: EvidenceRow): CloudEvidenceObject {
  return {
    id: row.id,
    projectId: row.project_id,
    artifactId: row.artifact_id,
    filename: row.filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    sha256: row.sha256,
    createdAt: row.created_at,
    deletionPending: row.deletion_requested_at !== null,
  };
}

export function requireCloudEvidenceWriteRole(context: CloudRequestContext) {
  if (!isCloudEvidenceWritableRole(context.role)) {
    throw new CloudHttpError(
      403,
      "evidence_write_denied",
      "Your organization role cannot retain or remove cloud evidence files.",
    );
  }
}

export async function requireCloudEvidenceProject(
  context: CloudRequestContext,
  projectId: string,
) {
  const record = await getCloudProject(context, projectId);
  if (!record) {
    throw new CloudHttpError(
      404,
      "cloud_project_required",
      "Save this project to secure cloud storage before retaining original evidence files.",
    );
  }
  return record;
}

export async function listCloudEvidence(
  context: CloudRequestContext,
  projectId: string,
) {
  const { data, error } = await context.client
    .from("evidence_objects")
    .select("id, project_id, artifact_id, storage_path, filename, mime_type, byte_size, sha256, created_at, deletion_requested_at")
    .eq("organization_id", context.organizationId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    throw new CloudHttpError(
      503,
      "cloud_evidence_unavailable",
      "Retained evidence files could not be loaded.",
    );
  }
  return (data ?? []).map((value) => evidenceFromRow(parseEvidenceRow(value)));
}

export async function getCloudEvidence(
  context: CloudRequestContext,
  projectId: string,
  evidenceId: string,
): Promise<CloudEvidenceRecord | null> {
  const { data, error } = await context.client
    .from("evidence_objects")
    .select("id, project_id, artifact_id, storage_path, filename, mime_type, byte_size, sha256, created_at, deletion_requested_at")
    .eq("organization_id", context.organizationId)
    .eq("project_id", projectId)
    .eq("id", evidenceId)
    .maybeSingle();
  if (error) {
    throw new CloudHttpError(
      503,
      "cloud_evidence_unavailable",
      "The retained evidence file could not be loaded.",
    );
  }
  if (!data) return null;
  const row = parseEvidenceRow(data);
  const expectedPrefix = `${context.organizationId}/${projectId}/evidence/`;
  if (!row.storage_path.startsWith(expectedPrefix)) {
    throw new CloudHttpError(
      502,
      "cloud_evidence_path_error",
      "A retained evidence file failed its project-isolation check.",
    );
  }
  return { evidence: evidenceFromRow(row), storagePath: row.storage_path };
}

export async function registerCloudEvidence(
  context: CloudRequestContext,
  input: RegisterEvidenceInput,
) {
  const { data, error } = await context.client.rpc("register_kingxford_evidence", {
    p_organization_id: context.organizationId,
    p_project_id: input.projectId,
    p_artifact_id: input.artifactId,
    p_storage_path: input.storagePath,
    p_filename: input.filename,
    p_mime_type: input.mimeType,
    p_byte_size: input.byteSize,
    p_sha256: input.sha256,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
  if (error) {
    if (error.code === "KX409") {
      throw new CloudHttpError(
        409,
        "idempotency_conflict",
        "The idempotency key was already used for a different evidence file.",
      );
    }
    if (error.code === "KX403") {
      throw new CloudHttpError(
        403,
        "evidence_write_denied",
        "Your organization role cannot retain cloud evidence files.",
      );
    }
    if (error.code === "KX404") {
      throw new CloudHttpError(404, "cloud_project_required", "The cloud project or linked evidence artifact was not found.");
    }
    throw new CloudHttpError(
      503,
      "cloud_evidence_write_failed",
      "The original evidence file could not be retained.",
    );
  }
  const response = asRecord(data);
  if (!response || typeof response.evidence_id !== "string" || typeof response.replayed !== "boolean") {
    throw new CloudHttpError(502, "invalid_evidence_response", "The evidence service returned an invalid result.");
  }
  const record = await getCloudEvidence(
    context,
    input.projectId,
    response.evidence_id,
  );
  if (!record) {
    throw new CloudHttpError(502, "cloud_evidence_not_visible", "The retained evidence record could not be verified.");
  }
  return { ...record, replayed: response.replayed } as const;
}

export async function deleteCloudEvidenceRecord(
  context: CloudRequestContext,
  input: Readonly<{
    projectId: string;
    evidenceId: string;
    idempotencyKey: string;
    requestHash: string;
  }>,
) {
  const { data, error } = await context.client.rpc("delete_kingxford_evidence", {
    p_organization_id: context.organizationId,
    p_project_id: input.projectId,
    p_evidence_id: input.evidenceId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
  if (error) {
    if (error.code === "KX409") {
      throw new CloudHttpError(
        409,
        "idempotency_conflict",
        "The idempotency key was already used for another cloud change.",
      );
    }
    if (error.code === "KX403") {
      throw new CloudHttpError(
        403,
        "evidence_delete_denied",
        "Your organization role cannot remove cloud evidence files.",
      );
    }
    throw new CloudHttpError(
      503,
      "cloud_evidence_delete_failed",
      "The retained evidence record could not be removed.",
    );
  }
  const response = asRecord(data);
  if (
    !response
    || (response.status !== "deletion_pending" && response.status !== "deleted" && response.status !== "not_found")
    || typeof response.replayed !== "boolean"
    || (response.storage_path !== null && typeof response.storage_path !== "string")
  ) {
    throw new CloudHttpError(502, "invalid_evidence_response", "The evidence service returned an invalid result.");
  }
  return {
    status: response.status,
    replayed: response.replayed,
    storagePath: response.storage_path as string | null,
  } as const;
}

export async function completeCloudEvidenceDeletion(
  context: CloudRequestContext,
  input: Readonly<{
    projectId: string;
    evidenceId: string;
    idempotencyKey: string;
    requestHash: string;
  }>,
) {
  const { data, error } = await context.client.rpc(
    "complete_kingxford_evidence_deletion",
    {
      p_organization_id: context.organizationId,
      p_project_id: input.projectId,
      p_evidence_id: input.evidenceId,
      p_idempotency_key: input.idempotencyKey,
      p_request_hash: input.requestHash,
    },
  );
  if (error) {
    if (error.code === "KX409") {
      throw new CloudHttpError(
        409,
        "evidence_delete_conflict",
        "The evidence removal request no longer matches its prepared change.",
      );
    }
    if (error.code === "KX403") {
      throw new CloudHttpError(
        403,
        "evidence_delete_denied",
        "Your organization role cannot remove cloud evidence files.",
      );
    }
    throw new CloudHttpError(
      503,
      "cloud_evidence_delete_incomplete",
      "The private file was removed, but its deletion record still requires completion. Retry removal from the evidence list.",
    );
  }
  const response = asRecord(data);
  if (!response || response.status !== "deleted" || typeof response.replayed !== "boolean") {
    throw new CloudHttpError(502, "invalid_evidence_response", "The evidence service returned an invalid result.");
  }
  return { status: "deleted" as const, replayed: response.replayed };
}

export async function uploadCloudEvidenceObject(
  input: Readonly<{
    storagePath: string;
    bytes: ArrayBuffer;
    mimeType: string;
    byteSize: number;
    sha256: string;
  }>,
) {
  const bucket = privateEvidenceBucket();
  const { error } = await bucket.upload(input.storagePath, input.bytes, {
    cacheControl: "0",
    contentType: input.mimeType,
    upsert: false,
  });
  if (!error) return { created: true } as const;

  // The deterministic request path makes a duplicate safe only when the exact
  // object is already present. This also recovers an upload that completed
  // before a transient metadata-write failure.
  const { data: existing, error: downloadError } = await bucket.download(
    input.storagePath,
  );
  if (!downloadError && existing) {
    const bytes = await existing.arrayBuffer();
    if (verifyDownloadedEvidence(bytes, input)) {
      return { created: false } as const;
    }
    throw new CloudHttpError(
      409,
      "cloud_evidence_path_conflict",
      "The evidence request path already contains different content.",
    );
  }
  throw new CloudHttpError(
    503,
    "cloud_evidence_upload_failed",
    "The original evidence file could not be retained.",
  );
}

export async function removeCloudEvidenceObject(
  storagePath: string,
) {
  return removeCloudEvidenceObjects([storagePath]);
}

export async function removeCloudEvidenceObjects(
  storagePaths: readonly string[],
) {
  if (storagePaths.length === 0) return;
  const { error } = await privateEvidenceBucket().remove([...storagePaths]);
  if (error) {
    throw new CloudHttpError(
      503,
      "cloud_evidence_storage_delete_failed",
      "The original evidence file could not be removed from private storage.",
    );
  }
}

export async function downloadCloudEvidenceObject(
  record: CloudEvidenceRecord,
) {
  const { data, error } = await privateEvidenceBucket().download(
    record.storagePath,
  );
  if (error || !data) {
    throw new CloudHttpError(
      503,
      "cloud_evidence_download_failed",
      "The retained evidence file could not be downloaded.",
    );
  }
  const bytes = await data.arrayBuffer();
  if (!verifyDownloadedEvidence(bytes, record.evidence)) {
    throw new CloudHttpError(
      502,
      "cloud_evidence_integrity_error",
      "The retained evidence file failed its integrity check and was not delivered.",
    );
  }
  return bytes;
}
