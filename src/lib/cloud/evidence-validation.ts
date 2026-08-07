import { createHash } from "node:crypto";

import {
  cloudEvidenceExtension,
  cloudEvidenceStoragePath,
  normalizeCloudEvidenceFilename,
  validateCloudEvidenceMediaType,
  type SupportedEvidenceExtension,
} from "./evidence-contracts";
import { CloudHttpError } from "./http";
import { EVIDENCE_INGESTION_LIMITS } from "@/lib/workspace/evidence-ingestion";

const textExtensions = new Set<SupportedEvidenceExtension>([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
]);

function sha256(value: ArrayBuffer | string) {
  return createHash("sha256").update(
    typeof value === "string" ? value : new Uint8Array(value),
  ).digest("hex");
}

function validateTextEvidence(
  bytes: ArrayBuffer,
  extension: SupportedEvidenceExtension,
) {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CloudHttpError(
      400,
      "invalid_evidence_encoding",
      "Text evidence must use UTF-8 encoding.",
    );
  }
  const cleaned = text.replaceAll("\u0000", "").replace(/\r\n?/g, "\n").trim();
  if (!cleaned || cleaned !== text.replace(/\r\n?/g, "\n").trim()) {
    throw new CloudHttpError(
      400,
      "invalid_evidence_text",
      "Text evidence must contain non-empty UTF-8 text without null characters.",
    );
  }
  if (cleaned.length > EVIDENCE_INGESTION_LIMITS.textCharacters) {
    throw new CloudHttpError(
      413,
      "evidence_text_too_large",
      `Evidence text is limited to ${EVIDENCE_INGESTION_LIMITS.textCharacters.toLocaleString()} characters.`,
    );
  }
  if (extension === ".json") {
    try {
      JSON.parse(cleaned);
    } catch {
      throw new CloudHttpError(
        400,
        "invalid_evidence_json",
        "JSON evidence must contain valid JSON.",
      );
    }
  }
}

async function validatePdfEvidence(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  const signature = new TextDecoder("ascii").decode(view.slice(0, 5));
  if (signature !== "%PDF-") {
    throw new CloudHttpError(
      400,
      "invalid_evidence_pdf",
      "The selected PDF does not contain a valid PDF signature.",
    );
  }
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: view,
      disableFontFace: true,
      stopAtErrors: true,
      useSystemFonts: true,
      useWorkerFetch: false,
    });
    try {
      const document = await task.promise;
      if (document.numPages > EVIDENCE_INGESTION_LIMITS.pdfPages) {
        throw new CloudHttpError(
          413,
          "evidence_pdf_too_long",
          `PDF evidence is limited to ${EVIDENCE_INGESTION_LIMITS.pdfPages} pages.`,
        );
      }
      let extractedCharacters = 0;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        try {
          const content = await page.getTextContent();
          for (const item of content.items) {
            if (typeof item === "object" && item !== null && "str" in item) {
              const value = (item as { str?: unknown }).str;
              if (typeof value === "string") extractedCharacters += value.length;
            }
          }
          if (extractedCharacters > EVIDENCE_INGESTION_LIMITS.textCharacters) {
            throw new CloudHttpError(
              413,
              "evidence_pdf_text_too_large",
              `Extracted PDF text is limited to ${EVIDENCE_INGESTION_LIMITS.textCharacters.toLocaleString()} characters.`,
            );
          }
        } finally {
          page.cleanup();
        }
      }
    } finally {
      await task.destroy().catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof CloudHttpError) throw error;
    throw new CloudHttpError(
      400,
      "invalid_evidence_pdf",
      "The selected PDF could not be validated and was not retained.",
    );
  }
}

export type ValidatedCloudEvidenceFile = Readonly<{
  filename: string;
  extension: SupportedEvidenceExtension;
  mimeType: string;
  byteSize: number;
  sha256: string;
  bytes: ArrayBuffer;
}>;

export async function validateCloudEvidenceFile(
  value: FormDataEntryValue | null,
): Promise<ValidatedCloudEvidenceFile> {
  if (!(value instanceof File)) {
    throw new CloudHttpError(400, "evidence_file_required", "Choose one evidence file to retain.");
  }
  if (value.size < 1) {
    throw new CloudHttpError(400, "empty_evidence_file", "The selected evidence file is empty.");
  }
  if (value.size > EVIDENCE_INGESTION_LIMITS.fileBytes) {
    throw new CloudHttpError(
      413,
      "evidence_file_too_large",
      `Evidence files are limited to ${Math.floor(EVIDENCE_INGESTION_LIMITS.fileBytes / 1024 / 1024)} MB.`,
    );
  }

  let filename: string;
  try {
    filename = normalizeCloudEvidenceFilename(value.name);
  } catch {
    throw new CloudHttpError(400, "invalid_evidence_filename", "The evidence file name is invalid.");
  }
  const extension = cloudEvidenceExtension(filename);
  if (!extension) {
    throw new CloudHttpError(
      415,
      "unsupported_evidence_type",
      "Use a supported text, Markdown, CSV, JSON, or PDF evidence file.",
    );
  }
  let mimeType: string;
  try {
    mimeType = validateCloudEvidenceMediaType(extension, value.type);
  } catch {
    throw new CloudHttpError(
      415,
      "evidence_type_mismatch",
      "The evidence file extension and media type do not match.",
    );
  }

  const bytes = await value.arrayBuffer();
  if (bytes.byteLength !== value.size) {
    throw new CloudHttpError(400, "evidence_size_mismatch", "The evidence file size could not be verified.");
  }
  if (textExtensions.has(extension)) validateTextEvidence(bytes, extension);
  else await validatePdfEvidence(bytes);

  return {
    filename,
    extension,
    mimeType,
    byteSize: bytes.byteLength,
    sha256: sha256(bytes),
    bytes,
  };
}

export function evidenceRequestDigest(value: string) {
  return sha256(value);
}

export function buildCloudEvidencePath(input: Readonly<{
  organizationId: string;
  projectId: string;
  idempotencyKey: string;
  sha256: string;
  extension: SupportedEvidenceExtension;
}>) {
  return cloudEvidenceStoragePath({
    ...input,
    idempotencyDigest: evidenceRequestDigest(input.idempotencyKey),
  });
}

export function verifyDownloadedEvidence(
  bytes: ArrayBuffer,
  expected: Readonly<{ byteSize: number; sha256: string }>,
) {
  return bytes.byteLength === expected.byteSize && sha256(bytes) === expected.sha256;
}
