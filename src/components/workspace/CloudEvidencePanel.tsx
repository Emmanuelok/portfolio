"use client";

import {
  AlertTriangle,
  Check,
  CloudOff,
  Download,
  FileKey2,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  deleteCloudEvidence,
  fetchCloudEvidenceIndex,
  retainCloudEvidence,
  type CloudEvidenceIndex,
} from "@/lib/cloud/evidence-client";
import { cloudEvidenceDownloadPath } from "@/lib/cloud/evidence-contracts";
import { CloudClientError } from "@/lib/cloud/client-sync";
import {
  EVIDENCE_INGESTION_LIMITS,
  supportedEvidenceExtensions,
} from "@/lib/workspace/evidence-ingestion";
import type { KingxfordProject } from "@/lib/workspace/project-graph";

import styles from "./CloudEvidencePanel.module.css";

type ViewState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "unavailable"; message: string }>
  | Readonly<{ status: "ready"; index: CloudEvidenceIndex }>;

type Notice = Readonly<{
  tone: "success" | "warning" | "error";
  message: string;
}>;

export type CloudEvidencePanelProps = Readonly<{
  project: KingxfordProject;
  disabled?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
}>;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function errorMessage(error: unknown) {
  if (error instanceof CloudClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "The private evidence request could not be completed.";
}

export function CloudEvidencePanel({
  project,
  disabled = false,
  headingLevel = "h2",
  className,
}: CloudEvidencePanelProps) {
  const Heading = headingLevel;
  const headingId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const loadSequenceRef = useRef(0);
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [file, setFile] = useState<File | null>(null);
  const [artifactId, setArtifactId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const sequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = sequence;
    try {
      const index = await fetchCloudEvidenceIndex(project.id);
      if (mountedRef.current && sequence === loadSequenceRef.current) {
        setView({ status: "ready", index });
      }
    } catch (error) {
      if (!mountedRef.current || sequence !== loadSequenceRef.current) return;
      setView({ status: "unavailable", message: errorMessage(error) });
    }
  }, [project.id]);

  useEffect(() => {
    const initialization = window.setTimeout(() => {
      setView({ status: "loading" });
      setFile(null);
      setArtifactId("");
      setConfirmDeleteId(null);
      setNotice(null);
      void load();
    }, 0);
    return () => {
      window.clearTimeout(initialization);
      loadSequenceRef.current += 1;
    };
  }, [load]);

  const evidenceArtifacts = useMemo(
    () => project.artifacts.filter(({ kind }) => kind === "evidence"),
    [project.artifacts],
  );

  const retainOriginal = async () => {
    if (!file || view.status !== "ready" || !view.index.canWrite || disabled || busy) return;
    setBusy("upload");
    setNotice(null);
    try {
      const retained = await retainCloudEvidence(project.id, file, artifactId || null);
      if (!mountedRef.current) return;
      setView({
        status: "ready",
        index: {
          ...view.index,
          evidence: [
            retained,
            ...view.index.evidence.filter(({ id }) => id !== retained.id),
          ],
        },
      });
      setFile(null);
      setArtifactId("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice({
        tone: "success",
        message: "The original file was retained in private project storage.",
      });
    } catch (error) {
      if (mountedRef.current) {
        setNotice({ tone: "error", message: errorMessage(error) });
        await load();
      }
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  const removeOriginal = async (evidenceId: string) => {
    if (view.status !== "ready" || !view.index.canWrite || disabled || busy) return;
    setBusy(`delete:${evidenceId}`);
    setNotice(null);
    try {
      await deleteCloudEvidence(project.id, evidenceId);
      if (!mountedRef.current) return;
      setView({
        status: "ready",
        index: {
          ...view.index,
          evidence: view.index.evidence.filter(({ id }) => id !== evidenceId),
        },
      });
      setConfirmDeleteId(null);
      setNotice({ tone: "success", message: "The retained original was permanently removed." });
    } catch (error) {
      if (mountedRef.current) {
        setNotice({ tone: "error", message: errorMessage(error) });
        await load();
      }
    } finally {
      if (mountedRef.current) setBusy(null);
    }
  };

  return (
    <section
      className={`${styles.panel} ${className ?? ""}`}
      aria-labelledby={headingId}
      data-cloud-evidence
    >
      <header className={styles.header}>
        <div>
          <span><ShieldCheck aria-hidden="true" /> Private evidence originals</span>
          <Heading id={headingId}>Retain source files deliberately.</Heading>
        </div>
        <p>
          Originals are encrypted in transit and held in private organization storage.
          Nothing is uploaded when you record local evidence; select and retain each file explicitly.
        </p>
      </header>

      {view.status === "loading" ? (
        <div className={styles.state} role="status">
          <LoaderCircle className={styles.spinner} aria-hidden="true" />
          <span>Checking private evidence storage…</span>
        </div>
      ) : view.status === "unavailable" ? (
        <div className={styles.state} data-tone="warning">
          <CloudOff aria-hidden="true" />
          <span>{view.message}</span>
          <button type="button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" /> Retry
          </button>
        </div>
      ) : (
        <>
          {notice ? (
            <div
              className={styles.notice}
              data-tone={notice.tone}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              {notice.tone === "success"
                ? <Check aria-hidden="true" />
                : <AlertTriangle aria-hidden="true" />}
              <span>{notice.message}</span>
            </div>
          ) : null}

          <div className={styles.retainForm} aria-label="Retain an original evidence file">
            <label className={styles.filePicker}>
              <UploadCloud aria-hidden="true" />
              <span>
                <strong>{file?.name ?? "Choose an original file"}</strong>
                <small>
                  {supportedEvidenceExtensions.join(", ")} · up to {Math.floor(EVIDENCE_INGESTION_LIMITS.fileBytes / 1024 / 1024)} MB
                </small>
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept={supportedEvidenceExtensions.join(",")}
                disabled={disabled || Boolean(busy) || !view.index.canWrite}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setNotice(null);
                }}
              />
            </label>
            <label>
              <span>Linked Atlas evidence (optional)</span>
              <select
                value={artifactId}
                disabled={disabled || Boolean(busy) || !view.index.canWrite}
                onChange={(event) => setArtifactId(event.target.value)}
              >
                <option value="">No artifact link</option>
                {evidenceArtifacts.map((artifact) => (
                  <option value={artifact.id} key={artifact.id}>{artifact.title}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={disabled || Boolean(busy) || !file || !view.index.canWrite}
              onClick={() => void retainOriginal()}
            >
              {busy === "upload"
                ? <LoaderCircle className={styles.spinner} aria-hidden="true" />
                : <FileKey2 aria-hidden="true" />}
              {busy === "upload" ? "Retaining…" : "Retain original in cloud"}
            </button>
          </div>

          {!view.index.canWrite ? (
            <p className={styles.readOnly}>
              Your {view.index.role} role can review and download retained files but cannot change them.
            </p>
          ) : null}

          <div className={styles.library}>
            <div className={styles.libraryHeading}>
              <strong>Retained originals</strong>
              <span>{view.index.evidence.length} file{view.index.evidence.length === 1 ? "" : "s"}</span>
            </div>
            {view.index.evidence.length === 0 ? (
              <p className={styles.empty}>No original evidence files have been retained for this cloud project.</p>
            ) : (
              <ul>
                {view.index.evidence.map((evidence) => (
                  <li key={evidence.id}>
                    <FileKey2 aria-hidden="true" />
                    <div>
                      <strong>{evidence.filename}</strong>
                      <span>
                        {formatBytes(evidence.byteSize)} · {formatDate(evidence.createdAt)}
                        {evidence.artifactId ? " · linked to Atlas evidence" : ""}
                        {evidence.deletionPending ? " · removal pending" : ""}
                      </span>
                      <code title="SHA-256 integrity digest">SHA-256 {evidence.sha256.slice(0, 12)}…</code>
                    </div>
                    <div className={styles.fileActions}>
                      <a
                        href={cloudEvidenceDownloadPath(
                          project.id,
                          evidence.id,
                          view.index.organizationId,
                        )}
                        download
                      >
                        <Download aria-hidden="true" /> Download
                      </a>
                      {view.index.canWrite ? (
                        confirmDeleteId === evidence.id ? (
                          <span className={styles.confirmDelete} role="group" aria-label={`Confirm removal of ${evidence.filename}`}>
                            <button
                              type="button"
                              disabled={Boolean(busy)}
                              onClick={() => void removeOriginal(evidence.id)}
                            >
                              {busy === `delete:${evidence.id}` ? "Removing…" : "Confirm removal"}
                            </button>
                            <button type="button" disabled={Boolean(busy)} onClick={() => setConfirmDeleteId(null)}>
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={disabled || Boolean(busy)}
                            onClick={() => setConfirmDeleteId(evidence.id)}
                          >
                            <Trash2 aria-hidden="true" /> {evidence.deletionPending ? "Retry removal" : "Remove"}
                          </button>
                        )
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
