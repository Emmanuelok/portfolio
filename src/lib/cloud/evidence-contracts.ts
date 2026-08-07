import {
  EVIDENCE_INGESTION_LIMITS,
  supportedEvidenceExtensions,
} from "@/lib/workspace/evidence-ingestion";

export const CLOUD_EVIDENCE_BUCKET = "kingxford-private" as const;
export const CLOUD_EVIDENCE_MULTIPART_OVERHEAD_BYTES = 64 * 1024;
export const CLOUD_EVIDENCE_MAX_REQUEST_BYTES =
  EVIDENCE_INGESTION_LIMITS.fileBytes + CLOUD_EVIDENCE_MULTIPART_OVERHEAD_BYTES;

export type SupportedEvidenceExtension =
  (typeof supportedEvidenceExtensions)[number];

export type CloudEvidenceObject = Readonly<{
  id: string;
  projectId: string;
  artifactId: string | null;
  filename: string;
  mimeType: string;
  byteSize: number;
  sha256: string;
  createdAt: string;
  deletionPending: boolean;
}>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const entityIdPattern = /^kx_[a-z][a-z0-9_]{0,23}_[0-9a-f]{16}$/;

const acceptedMimeTypes = Object.freeze({
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/plain"],
  ".markdown": ["text/markdown", "text/plain"],
  ".csv": ["text/csv", "application/csv", "text/comma-separated-values"],
  ".json": ["application/json", "text/json"],
  ".pdf": ["application/pdf"],
} satisfies Record<SupportedEvidenceExtension, readonly string[]>);

const canonicalMimeTypes = Object.freeze({
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".pdf": "application/pdf",
} satisfies Record<SupportedEvidenceExtension, string>);

export function parseCloudEvidenceId(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error("A valid evidence object identifier is required.");
  }
  return value.toLowerCase();
}

export function parseCloudEvidenceArtifactId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !entityIdPattern.test(value)) {
    throw new Error("The linked evidence artifact identifier is invalid.");
  }
  return value;
}

export function normalizeCloudEvidenceFilename(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("The evidence file name is invalid.");
  }
  const normalized = value
    .normalize("NFKC")
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error("The evidence file name is invalid.");
  }
  return normalized.slice(0, 180);
}

export function cloudEvidenceExtension(
  filename: string,
): SupportedEvidenceExtension | null {
  const lower = filename.toLocaleLowerCase("en");
  return supportedEvidenceExtensions.find((extension) =>
    lower.endsWith(extension)) ?? null;
}

export function validateCloudEvidenceMediaType(
  extension: SupportedEvidenceExtension,
  value: unknown,
) {
  if (typeof value !== "string") {
    throw new Error("The evidence file media type is required.");
  }
  const mediaType = value.split(";", 1)[0]?.trim().toLocaleLowerCase("en") ?? "";
  if (!acceptedMimeTypes[extension].includes(mediaType)) {
    throw new Error(
      `The ${extension} extension does not match the supplied file media type.`,
    );
  }
  return canonicalMimeTypes[extension];
}

export function cloudEvidenceStoragePath(input: Readonly<{
  organizationId: string;
  projectId: string;
  idempotencyDigest: string;
  sha256: string;
  extension: SupportedEvidenceExtension;
}>) {
  if (!/^[0-9a-f]{64}$/.test(input.idempotencyDigest)) {
    throw new Error("The evidence request digest is invalid.");
  }
  if (!/^[0-9a-f]{64}$/.test(input.sha256)) {
    throw new Error("The evidence content digest is invalid.");
  }
  return [
    input.organizationId,
    input.projectId,
    "evidence",
    `${input.idempotencyDigest.slice(0, 32)}-${input.sha256.slice(0, 32)}${input.extension}`,
  ].join("/");
}

export function cloudEvidenceDownloadPath(
  projectId: string,
  evidenceId: string,
  organizationId?: string,
) {
  const path = `/api/cloud/projects/${encodeURIComponent(projectId)}/evidence/${encodeURIComponent(evidenceId)}`;
  return organizationId
    ? `${path}?organization=${encodeURIComponent(organizationId)}`
    : path;
}

export function isCloudEvidenceWritableRole(role: string) {
  return role === "owner" || role === "admin" || role === "editor";
}
