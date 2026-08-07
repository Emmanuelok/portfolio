import { z } from "zod";

import {
  parseKingxfordProject,
  stableHash,
  type KingxfordProject,
} from "@/lib/workspace/project-graph";

export const cloudRoles = ["owner", "admin", "editor", "reviewer", "viewer"] as const;
export type CloudRole = (typeof cloudRoles)[number];

export const CLOUD_SYNC_PROJECT_LIMIT = 20;
export const CLOUD_IDEMPOTENCY_KEY_LIMIT = 160;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

const upsertEnvelopeSchema = z.object({
  project: z.unknown(),
  expectedVersion: z.number().int().nonnegative().nullable().optional(),
}).strict();

const syncEnvelopeSchema = z.object({
  projects: z.array(upsertEnvelopeSchema).min(1).max(CLOUD_SYNC_PROJECT_LIMIT),
}).strict();

export type CloudProjectWrite = Readonly<{
  project: KingxfordProject;
  expectedVersion: number | null;
}>;

export type CloudProjectSummary = Readonly<{
  id: string;
  title: string;
  summary: string;
  activePhase: KingxfordProject["activePhase"];
  version: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
  etag: string;
}>;

export function isCloudRole(value: unknown): value is CloudRole {
  return typeof value === "string" && cloudRoles.includes(value as CloudRole);
}

export function parseOrganizationId(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error("A valid organization identifier is required.");
  }
  return value.toLowerCase();
}

export function parseCloudProjectId(value: unknown) {
  if (
    typeof value !== "string"
    || !/^kx_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}$/.test(value)
  ) {
    throw new Error("A valid Kingxford project identifier is required.");
  }
  return value;
}

export function parseIdempotencyKey(value: string | null) {
  const key = value?.trim() ?? "";
  if (
    key.length < 8
    || key.length > CLOUD_IDEMPOTENCY_KEY_LIMIT
    || !idempotencyKeyPattern.test(key)
  ) {
    throw new Error(
      `Idempotency-Key must be 8–${CLOUD_IDEMPOTENCY_KEY_LIMIT} characters using letters, numbers, dots, colons, underscores, or hyphens.`,
    );
  }
  return key;
}

export function parseCloudProjectWrite(value: unknown): CloudProjectWrite {
  const envelope = upsertEnvelopeSchema.parse(value);
  return {
    project: parseKingxfordProject(envelope.project),
    expectedVersion: envelope.expectedVersion ?? null,
  };
}

export function parseCloudSyncWrite(value: unknown) {
  const envelope = syncEnvelopeSchema.parse(value);
  const projects = envelope.projects.map(parseCloudProjectWrite);
  const ids = projects.map(({ project }) => project.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("A sync request cannot contain the same project more than once.");
  }
  return { projects } as const;
}

export function cloudProjectContentHash(project: KingxfordProject) {
  return stableHash(project);
}

export function formatCloudProjectEtag(version: number, contentHash: string) {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Cloud project version must be a positive integer.");
  }
  if (!/^kxhash_[0-9a-f]{32}$/.test(contentHash)) {
    throw new Error("Cloud project content hash is invalid.");
  }
  return `"kxcloud-v${version}-${contentHash}"`;
}

export function matchesIfMatch(ifMatch: string | null, etag: string) {
  if (!ifMatch) return false;
  return ifMatch
    .split(",")
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === "*" || candidate === etag);
}

export type ParsedCloudEtag = Readonly<{
  version: number;
  contentHash: string;
}>;

export function parseCloudProjectEtag(value: string | null): ParsedCloudEtag | null {
  if (!value) return null;
  const match = /^"kxcloud-v([1-9]\d*)-(kxhash_[0-9a-f]{32})"$/.exec(value.trim());
  if (!match) return null;
  const version = Number(match[1]);
  if (!Number.isSafeInteger(version)) return null;
  return { version, contentHash: match[2] };
}

export function requestFingerprint(value: unknown) {
  return stableHash(value);
}
