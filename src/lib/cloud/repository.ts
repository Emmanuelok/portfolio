import {
  cloudProjectContentHash,
  formatCloudProjectEtag,
  type CloudProjectSummary,
  type CloudProjectWrite,
} from "./contracts";
import type { CloudRequestContext } from "./auth";
import { CloudHttpError } from "./http";
import { parseKingxfordProject, type KingxfordProject } from "@/lib/workspace/project-graph";

type CloudProjectRow = Readonly<{
  id: string;
  title: string;
  summary: string;
  active_phase: KingxfordProject["activePhase"];
  document: unknown;
  version: number;
  content_hash: string;
  created_at: string;
  updated_at: string;
}>;

export type CloudMutationResult = Readonly<{
  status: "created" | "updated" | "deleted" | "conflict";
  projectId: string;
  version: number | null;
  contentHash: string | null;
  replayed: boolean;
  updatedAt: string | null;
  storagePaths: readonly string[];
}>;

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseCloudProjectRow(value: unknown): CloudProjectRow {
  const row = asRecord(value);
  if (
    !row
    || typeof row.id !== "string"
    || typeof row.title !== "string"
    || typeof row.summary !== "string"
    || typeof row.active_phase !== "string"
    || typeof row.version !== "number"
    || !Number.isSafeInteger(row.version)
    || row.version < 1
    || typeof row.content_hash !== "string"
    || typeof row.created_at !== "string"
    || typeof row.updated_at !== "string"
  ) {
    throw new CloudHttpError(502, "invalid_cloud_record", "A cloud project record is invalid.");
  }
  const document = parseKingxfordProject(row.document);
  if (
    document.id !== row.id
    || document.title !== row.title
    || document.summary !== row.summary
    || document.activePhase !== row.active_phase
    || cloudProjectContentHash(document) !== row.content_hash
  ) {
    throw new CloudHttpError(502, "cloud_integrity_error", "A cloud project failed its integrity check.");
  }
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    active_phase: document.activePhase,
    document,
    version: row.version,
    content_hash: row.content_hash,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function summaryFromRow(row: CloudProjectRow): CloudProjectSummary {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    activePhase: row.active_phase,
    version: row.version,
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    etag: formatCloudProjectEtag(row.version, row.content_hash),
  };
}

function parseMutationResult(value: unknown): CloudMutationResult {
  const row = asRecord(value);
  const status = row?.status;
  if (
    !row
    || (status !== "created" && status !== "updated" && status !== "deleted" && status !== "conflict")
    || typeof row.project_id !== "string"
    || (row.version !== null && (typeof row.version !== "number" || !Number.isSafeInteger(row.version)))
    || (row.content_hash !== null && typeof row.content_hash !== "string")
    || typeof row.replayed !== "boolean"
    || (row.updated_at !== null && typeof row.updated_at !== "string")
    || (row.storage_paths !== undefined && (
      !Array.isArray(row.storage_paths)
      || row.storage_paths.some((path) => typeof path !== "string")
    ))
  ) {
    throw new CloudHttpError(502, "invalid_cloud_response", "The cloud project service returned an invalid result.");
  }
  return {
    status,
    projectId: row.project_id,
    version: row.version,
    contentHash: row.content_hash,
    replayed: row.replayed,
    updatedAt: row.updated_at,
    storagePaths: (row.storage_paths ?? []) as string[],
  };
}

export async function listCloudProjects(context: CloudRequestContext) {
  const { data, error } = await context.client
    .from("projects")
    .select("id, title, summary, active_phase, document, version, content_hash, created_at, updated_at")
    .eq("organization_id", context.organizationId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new CloudHttpError(503, "cloud_projects_unavailable", "Cloud projects could not be loaded.");
  }
  return (data ?? []).map((row) => summaryFromRow(parseCloudProjectRow(row)));
}

export async function getCloudProject(
  context: CloudRequestContext,
  projectId: string,
) {
  const { data, error } = await context.client
    .from("projects")
    .select("id, title, summary, active_phase, document, version, content_hash, created_at, updated_at")
    .eq("organization_id", context.organizationId)
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new CloudHttpError(503, "cloud_project_unavailable", "The cloud project could not be loaded.");
  }
  if (!data) return null;
  const row = parseCloudProjectRow(data);
  return {
    project: row.document as KingxfordProject,
    summary: summaryFromRow(row),
  } as const;
}

export async function mutateCloudProject(
  context: CloudRequestContext,
  write: CloudProjectWrite,
  options: Readonly<{
    idempotencyKey: string;
    requestHash: string;
    expectedVersion: number | null;
    expectedContentHash: string | null;
  }>,
) {
  const project = write.project;
  const { data, error } = await context.client.rpc("upsert_kingxford_project", {
    p_organization_id: context.organizationId,
    p_project_id: project.id,
    p_project: project,
    p_title: project.title,
    p_summary: project.summary,
    p_active_phase: project.activePhase,
    p_content_hash: cloudProjectContentHash(project),
    p_expected_version: options.expectedVersion,
    p_expected_content_hash: options.expectedContentHash,
    p_idempotency_key: options.idempotencyKey,
    p_request_hash: options.requestHash,
  });

  if (error) {
    if (error.code === "KX409") {
      throw new CloudHttpError(409, "idempotency_conflict", "The idempotency key was already used for a different request.");
    }
    if (error.code === "KX403") {
      throw new CloudHttpError(403, "project_write_denied", "Your organization role cannot change projects.");
    }
    throw new CloudHttpError(503, "cloud_project_write_failed", "The cloud project could not be saved.");
  }
  return parseMutationResult(data);
}

export async function deleteCloudProject(
  context: CloudRequestContext,
  projectId: string,
  options: Readonly<{
    idempotencyKey: string;
    requestHash: string;
    expectedVersion: number;
    expectedContentHash: string;
  }>,
) {
  const { data, error } = await context.client.rpc("delete_kingxford_project", {
    p_organization_id: context.organizationId,
    p_project_id: projectId,
    p_expected_version: options.expectedVersion,
    p_expected_content_hash: options.expectedContentHash,
    p_idempotency_key: options.idempotencyKey,
    p_request_hash: options.requestHash,
  });
  if (error) {
    if (error.code === "KX409") {
      throw new CloudHttpError(409, "idempotency_conflict", "The idempotency key was already used for a different request.");
    }
    if (error.code === "KX403") {
      throw new CloudHttpError(403, "project_delete_denied", "Only organization owners and administrators can delete cloud projects.");
    }
    throw new CloudHttpError(503, "cloud_project_delete_failed", "The cloud project could not be deleted.");
  }
  return parseMutationResult(data);
}
