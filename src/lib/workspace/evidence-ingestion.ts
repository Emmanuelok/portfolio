import {
  appendArtifactRevision,
  connectProjectNodes,
  stableEntityId,
  textRevisionBody,
  upsertProjectNode,
  type KingxfordProject,
  type ProjectNodeStatus,
  type ProjectPhase,
} from "./project-graph";

export const EVIDENCE_INGESTION_LIMITS = Object.freeze({
  titleCharacters: 160,
  sourceUrlCharacters: 320,
  textCharacters: 45_000,
  fileBytes: 5 * 1024 * 1024,
  pdfPages: 24,
  nodeStatementCharacters: 1_200,
});

export const supportedEvidenceExtensions = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".pdf",
] as const;

export type EvidenceSourceKind = "pasted-text" | "url-reference" | "local-file";
export type EvidenceCaptureMethod = "direct-entry" | "url-record" | "local-text-read" | "local-pdf-extraction";

export type EvidenceProvenance = Readonly<{
  sourceKind: EvidenceSourceKind;
  captureMethod: EvidenceCaptureMethod;
  capturedAt: string;
  sourceUrl: string | null;
  sourceLabel: string;
  networkAccess: "none";
  file: Readonly<{
    name: string;
    type: string;
    size: number;
    lastModified: number;
    pages: number | null;
  }> | null;
}>;

export type GovernedEvidence = Readonly<{
  title: string;
  text: string;
  phase: ProjectPhase;
  status: Extract<ProjectNodeStatus, "known" | "unresolved">;
  provenance: EvidenceProvenance;
}>;

export class EvidenceIngestionError extends Error {
  readonly code:
    | "EMPTY"
    | "FILE_TYPE"
    | "FILE_SIZE"
    | "INVALID_URL"
    | "TEXT_SIZE"
    | "PDF_PAGES"
    | "PDF_PARSE"
    | "JSON_PARSE";

  constructor(code: EvidenceIngestionError["code"], message: string) {
    super(message);
    this.name = "EvidenceIngestionError";
    this.code = code;
  }
}

function cleanText(value: string) {
  return value
    .replaceAll("\u0000", "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function boundedTitle(value: string, fallback: string) {
  return (cleanText(value) || fallback).slice(0, EVIDENCE_INGESTION_LIMITS.titleCharacters);
}

function requireBoundedText(value: string) {
  const text = cleanText(value);
  if (!text) {
    throw new EvidenceIngestionError("EMPTY", "Add evidence text, a URL, or a supported local file.");
  }
  if (text.length > EVIDENCE_INGESTION_LIMITS.textCharacters) {
    throw new EvidenceIngestionError(
      "TEXT_SIZE",
      `Evidence is limited to ${EVIDENCE_INGESTION_LIMITS.textCharacters.toLocaleString()} characters per item. Divide this source into focused records.`,
    );
  }
  return text;
}

export function normalizeEvidenceUrl(value: string) {
  const raw = value.trim();
  if (!raw) return null;
  if (raw.length > EVIDENCE_INGESTION_LIMITS.sourceUrlCharacters) {
    throw new EvidenceIngestionError("INVALID_URL", "The source URL is too long to retain safely.");
  }
  try {
    const url = new URL(raw);
    if (!(["http:", "https:"] as const).includes(url.protocol as "http:" | "https:")) {
      throw new Error("Unsupported protocol");
    }
    if (url.username || url.password) throw new Error("Credentials are not allowed");
    url.hash = "";
    const normalized = url.toString();
    if (normalized.length > EVIDENCE_INGESTION_LIMITS.sourceUrlCharacters) {
      throw new Error("Normalized URL is too long");
    }
    return normalized;
  } catch {
    throw new EvidenceIngestionError(
      "INVALID_URL",
      "Enter a complete public http or https URL without embedded credentials.",
    );
  }
}

export type IngestPastedEvidenceInput = Readonly<{
  title: string;
  text: string;
  phase: ProjectPhase;
  sourceUrl?: string;
  status?: GovernedEvidence["status"];
  capturedAt?: string;
}>;

export function ingestPastedEvidence(input: IngestPastedEvidenceInput): GovernedEvidence {
  const text = requireBoundedText(input.text);
  const sourceUrl = normalizeEvidenceUrl(input.sourceUrl ?? "");
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  return {
    title: boundedTitle(input.title, "Pasted evidence"),
    text,
    phase: input.phase,
    status: input.status ?? "known",
    provenance: {
      sourceKind: "pasted-text",
      captureMethod: "direct-entry",
      capturedAt,
      sourceUrl,
      sourceLabel: sourceUrl ?? "Pasted directly by the project owner",
      networkAccess: "none",
      file: null,
    },
  };
}

export type IngestUrlEvidenceInput = Readonly<{
  title: string;
  url: string;
  notes?: string;
  phase: ProjectPhase;
  status?: GovernedEvidence["status"];
  capturedAt?: string;
}>;

export function ingestUrlEvidence(input: IngestUrlEvidenceInput): GovernedEvidence {
  const sourceUrl = normalizeEvidenceUrl(input.url);
  if (!sourceUrl) {
    throw new EvidenceIngestionError("INVALID_URL", "A source URL is required.");
  }
  const notes = cleanText(input.notes ?? "");
  const text = notes
    ? requireBoundedText(notes)
    : "URL recorded for manual examination. Kingxford did not fetch, summarize, or submit the page content.";
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  return {
    title: boundedTitle(input.title, new URL(sourceUrl).hostname),
    text,
    phase: input.phase,
    status: input.status ?? (notes ? "known" : "unresolved"),
    provenance: {
      sourceKind: "url-reference",
      captureMethod: "url-record",
      capturedAt,
      sourceUrl,
      sourceLabel: sourceUrl,
      networkAccess: "none",
      file: null,
    },
  };
}

function extensionFor(fileName: string) {
  const normalized = fileName.toLocaleLowerCase("en");
  return supportedEvidenceExtensions.find((extension) => normalized.endsWith(extension)) ?? null;
}

async function extractPdfText(file: File) {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const task = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      useSystemFonts: true,
      useWorkerFetch: false,
      stopAtErrors: true,
    });
    try {
      const document = await task.promise;
      if (document.numPages > EVIDENCE_INGESTION_LIMITS.pdfPages) {
        throw new EvidenceIngestionError(
          "PDF_PAGES",
          `PDF evidence is limited to ${EVIDENCE_INGESTION_LIMITS.pdfPages} pages. Add a focused excerpt or split the source.`,
        );
      }
      const pages: string[] = [];
      let characterCount = 0;
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        try {
          const content = await page.getTextContent();
          const pageText = cleanText(content.items
            .flatMap((item) => {
              if (typeof item !== "object" || item === null || !("str" in item)) return [];
              const value = (item as { str?: unknown }).str;
              return typeof value === "string" ? [value] : [];
            })
            .join(" "));
          characterCount += pageText.length;
          if (characterCount > EVIDENCE_INGESTION_LIMITS.textCharacters) {
            throw new EvidenceIngestionError(
              "TEXT_SIZE",
              `Extracted PDF text exceeds ${EVIDENCE_INGESTION_LIMITS.textCharacters.toLocaleString()} characters. Add a focused excerpt or split the source.`,
            );
          }
          pages.push(`## Page ${pageNumber}\n${pageText || "[No extractable text on this page]"}`);
        } finally {
          page.cleanup();
        }
      }
      return { text: requireBoundedText(pages.join("\n\n")), pages: document.numPages };
    } finally {
      await task.destroy().catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof EvidenceIngestionError) throw error;
    throw new EvidenceIngestionError(
      "PDF_PARSE",
      "This PDF could not be read locally. Use a text-exported PDF or paste a focused excerpt.",
    );
  }
}

export type IngestEvidenceFileOptions = Readonly<{
  title?: string;
  phase: ProjectPhase;
  sourceUrl?: string;
  status?: GovernedEvidence["status"];
  capturedAt?: string;
}>;

export async function ingestEvidenceFile(
  file: File,
  options: IngestEvidenceFileOptions,
): Promise<GovernedEvidence> {
  const extension = extensionFor(file.name);
  if (!extension) {
    throw new EvidenceIngestionError(
      "FILE_TYPE",
      `Use ${supportedEvidenceExtensions.join(", ")} files only.`,
    );
  }
  if (file.size > EVIDENCE_INGESTION_LIMITS.fileBytes) {
    throw new EvidenceIngestionError(
      "FILE_SIZE",
      `Local evidence files are limited to ${Math.floor(EVIDENCE_INGESTION_LIMITS.fileBytes / 1024 / 1024)} MB.`,
    );
  }
  if (file.size === 0) {
    throw new EvidenceIngestionError("EMPTY", "The selected file is empty.");
  }

  const sourceUrl = normalizeEvidenceUrl(options.sourceUrl ?? "");
  const capturedAt = options.capturedAt ?? new Date().toISOString();
  let text: string;
  let pages: number | null = null;
  let captureMethod: EvidenceCaptureMethod = "local-text-read";
  if (extension === ".pdf") {
    const extracted = await extractPdfText(file);
    text = extracted.text;
    pages = extracted.pages;
    captureMethod = "local-pdf-extraction";
  } else {
    text = requireBoundedText(await file.text());
    if (extension === ".json") {
      try {
        JSON.parse(text);
      } catch {
        throw new EvidenceIngestionError(
          "JSON_PARSE",
          "The selected JSON file is not valid JSON and was not added.",
        );
      }
    }
  }

  return {
    title: boundedTitle(options.title ?? "", file.name.replace(/\.[^.]+$/, "")),
    text,
    phase: options.phase,
    status: options.status ?? "known",
    provenance: {
      sourceKind: "local-file",
      captureMethod,
      capturedAt,
      sourceUrl,
      sourceLabel: sourceUrl ?? `Local file: ${file.name}`,
      networkAccess: "none",
      file: {
        name: file.name.slice(0, 180),
        type: (file.type || "application/octet-stream").slice(0, 120),
        size: file.size,
        lastModified: file.lastModified,
        pages,
      },
    },
  };
}

export function evidenceRevisionText(evidence: GovernedEvidence) {
  const file = evidence.provenance.file;
  return [
    `# ${evidence.title}`,
    "",
    "## Evidence content",
    evidence.text,
    "",
    "## Provenance",
    `- Capture method: ${evidence.provenance.captureMethod}`,
    `- Source type: ${evidence.provenance.sourceKind}`,
    `- Source: ${evidence.provenance.sourceLabel}`,
    `- Source URL: ${evidence.provenance.sourceUrl ?? "Not provided"}`,
    `- Captured: ${evidence.provenance.capturedAt}`,
    "- Network access during intake: none",
    `- Assessment status: ${evidence.status}`,
    ...(file
      ? [
          `- File name: ${file.name}`,
          `- File type: ${file.type}`,
          `- File size: ${file.size} bytes`,
          `- PDF pages: ${file.pages ?? "Not applicable"}`,
        ]
      : []),
  ].join("\n");
}

function sourceReference(evidence: GovernedEvidence) {
  if (evidence.provenance.sourceUrl) return evidence.provenance.sourceUrl;
  if (evidence.provenance.file) {
    return `local-file:${evidence.provenance.file.name}`.slice(
      0,
      EVIDENCE_INGESTION_LIMITS.sourceUrlCharacters,
    );
  }
  return "local-direct-entry";
}

export function addGovernedEvidenceToProject(
  project: KingxfordProject,
  evidence: GovernedEvidence,
): KingxfordProject {
  const recordedAt = evidence.provenance.capturedAt;
  const evidenceKey = [
    evidence.provenance.captureMethod,
    evidence.provenance.sourceLabel,
    evidence.title,
    recordedAt,
  ].join(":");
  let next = appendArtifactRevision(project, {
    kind: "evidence",
    title: evidence.title,
    phase: evidence.phase,
    body: textRevisionBody(evidenceRevisionText(evidence)),
    source: "human",
    createdAt: recordedAt,
  });
  const artifactId = next.activeArtifactId!;
  next = upsertProjectNode(next, {
    key: `governed-evidence:${evidenceKey}`,
    kind: "evidence",
    phase: evidence.phase,
    label: evidence.title,
    statement: evidence.text.slice(0, EVIDENCE_INGESTION_LIMITS.nodeStatementCharacters),
    status: evidence.status,
    sourceRef: sourceReference(evidence),
    recordedAt,
  });
  const evidenceNodeId = stableEntityId(
    "node",
    next.id,
    "evidence",
    `governed-evidence:${evidenceKey}`,
  );
  const artifactNode = next.nodes.find(
    (node) => node.kind === "artifact" && node.refId === artifactId,
  );
  if (artifactNode && next.nodes.some(({ id }) => id === evidenceNodeId)) {
    next = connectProjectNodes(next, {
      type: "supports",
      fromNodeId: artifactNode.id,
      toNodeId: evidenceNodeId,
      recordedAt,
    });
  }
  return next;
}
