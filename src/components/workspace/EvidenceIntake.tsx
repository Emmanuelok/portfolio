"use client";

import {
  BookOpenCheck,
  FileText,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Type,
  Upload,
} from "lucide-react";
import { type FormEvent, useId, useMemo, useRef, useState } from "react";

import {
  EVIDENCE_INGESTION_LIMITS,
  ingestEvidenceFile,
  ingestPastedEvidence,
  ingestUrlEvidence,
  supportedEvidenceExtensions,
  type GovernedEvidence,
} from "@/lib/workspace/evidence-ingestion";
import {
  projectPhases,
  type KingxfordProject,
  type ProjectPhase,
} from "@/lib/workspace/project-graph";
import { workflowPhaseReadiness } from "@/lib/workspace/workflow-templates";

import styles from "./EvidenceIntake.module.css";

type IntakeMode = "paste" | "url" | "file";

const intakeModes = [
  { id: "paste", label: "Paste text", description: "Add a focused excerpt or observation.", icon: Type },
  { id: "url", label: "Record URL", description: "Retain a reference without fetching it.", icon: Link2 },
  { id: "file", label: "Local file", description: "Read a supported file in this browser.", icon: FileText },
] as const satisfies readonly Readonly<{
  id: IntakeMode;
  label: string;
  description: string;
  icon: typeof Type;
}>[];

function phaseLabel(phase: ProjectPhase) {
  return phase.charAt(0).toLocaleUpperCase("en") + phase.slice(1);
}

export type EvidenceIntakeProps = Readonly<{
  project: KingxfordProject;
  disabled?: boolean;
  headingLevel?: "h2" | "h3";
  onAdd: (evidence: GovernedEvidence) => void | Promise<void>;
}>;

export function EvidenceIntake({
  project,
  disabled = false,
  headingLevel = "h2",
  onAdd,
}: EvidenceIntakeProps) {
  const instanceId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<IntakeMode>("paste");
  const [phase, setPhase] = useState<ProjectPhase>(project.activePhase);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<GovernedEvidence["status"]>("known");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const Heading = headingLevel;

  const readiness = useMemo(
    () => workflowPhaseReadiness(project, phase),
    [phase, project],
  );
  const phaseEvidenceCount = project.artifacts.filter(
    (artifact) => artifact.phase === phase && artifact.kind === "evidence",
  ).length;

  const submitEvidence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      const evidence = mode === "paste"
        ? ingestPastedEvidence({ title, text, sourceUrl: url, phase, status })
        : mode === "url"
          ? ingestUrlEvidence({
              title,
              url,
              notes: text,
              phase,
              status: text.trim() ? status : "unresolved",
            })
          : file
            ? await ingestEvidenceFile(file, { title, sourceUrl: url, phase, status })
            : null;
      if (!evidence) throw new Error("Choose a supported local file.");
      await onAdd(evidence);
      setTitle("");
      setText("");
      setUrl("");
      setFile(null);
      setStatus("known");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setNotice(`Evidence recorded in ${phaseLabel(phase)}. It remains on this device unless you deliberately start a review.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The evidence was not added. The project remains unchanged.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.intake} aria-labelledby={`${instanceId}-heading`} data-evidence-intake>
      <header className={styles.heading}>
        <div>
          <span><BookOpenCheck aria-hidden="true" /> Governed evidence intake</span>
          <Heading id={`${instanceId}-heading`}>Add sources without leaving Project Atlas.</Heading>
        </div>
        <p>
          Paste a focused passage, record a public URL, or read a supported file
          locally. Intake never fetches a URL, starts an AI review, or submits content.
        </p>
      </header>

      <form className={styles.form} onSubmit={(event) => void submitEvidence(event)}>
        <fieldset className={styles.modeChooser} disabled={disabled || submitting}>
          <legend>Evidence source</legend>
          {intakeModes.map((item) => {
            const Icon = item.icon;
            return (
              <label key={item.id}>
                <input
                  type="radio"
                  name={`${instanceId}-intake-mode`}
                  value={item.id}
                  checked={mode === item.id}
                  onChange={() => {
                    setMode(item.id);
                    setNotice("");
                  }}
                />
                <span>
                  <Icon aria-hidden="true" />
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className={styles.fields}>
          <label>
            <span>Evidence title</span>
            <input
              value={title}
              maxLength={EVIDENCE_INGESTION_LIMITS.titleCharacters}
              placeholder={mode === "file" ? "Defaults to the file name" : "Name this evidence item"}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label>
            <span>Atlas phase</span>
            <select value={phase} onChange={(event) => setPhase(event.target.value as ProjectPhase)}>
              {projectPhases.map((value) => (
                <option value={value} key={value}>{phaseLabel(value)}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Assessment</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as GovernedEvidence["status"])}
            >
              <option value="known">Establishes a known point</option>
              <option value="unresolved">Requires verification</option>
            </select>
          </label>
        </div>

        {mode === "file" ? (
          <label className={styles.fileDrop}>
            <Upload aria-hidden="true" />
            <span>
              <strong>{file ? file.name : "Choose a local evidence file"}</strong>
              <small>
                {supportedEvidenceExtensions.join(", ")} · up to {Math.floor(EVIDENCE_INGESTION_LIMITS.fileBytes / 1024 / 1024)} MB
                · PDF up to {EVIDENCE_INGESTION_LIMITS.pdfPages} pages
              </small>
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={supportedEvidenceExtensions.join(",")}
              disabled={disabled || submitting}
              onChange={(event) => {
                const selectedFile = event.target.files?.[0] ?? null;
                setFile(selectedFile);
                if (selectedFile && !title.trim()) {
                  setTitle(selectedFile.name.replace(/\.[^.]+$/, ""));
                }
              }}
            />
          </label>
        ) : (
          <label className={styles.textField}>
            <span>{mode === "url" ? "Notes or relevant claim (optional)" : "Evidence text"}</span>
            <textarea
              value={text}
              maxLength={EVIDENCE_INGESTION_LIMITS.textCharacters}
              rows={6}
              required={mode === "paste"}
              placeholder={mode === "url"
                ? "Record what this source may establish. Without notes, the URL is marked for verification."
                : "Paste a focused excerpt, observation, result, or documented claim."}
              onChange={(event) => setText(event.target.value)}
            />
            <small>{text.length.toLocaleString()} / {EVIDENCE_INGESTION_LIMITS.textCharacters.toLocaleString()} characters</small>
          </label>
        )}

        <label className={styles.urlField}>
          <span>{mode === "url" ? "Source URL" : "Source URL (optional)"}</span>
          <input
            type="url"
            inputMode="url"
            required={mode === "url"}
            value={url}
            maxLength={EVIDENCE_INGESTION_LIMITS.sourceUrlCharacters}
            placeholder="https://example.org/source"
            onChange={(event) => setUrl(event.target.value)}
          />
          <small>URLs are stored as provenance only. Kingxford does not fetch them during intake.</small>
        </label>

        <aside className={styles.governance} aria-label={`${phaseLabel(phase)} evidence requirement`}>
          <div>
            <ShieldCheck aria-hidden="true" />
            <span>
              <strong>{readiness?.gateTitle ?? `${phaseLabel(phase)} human gate`}</strong>
              <small>
                {readiness
                  ? `${phaseEvidenceCount} of ${readiness.minimumEvidence} required evidence items recorded`
                  : `${phaseEvidenceCount} evidence item${phaseEvidenceCount === 1 ? "" : "s"} recorded`}
              </small>
            </span>
          </div>
          <progress
            value={phaseEvidenceCount}
            max={Math.max(1, readiness?.minimumEvidence ?? phaseEvidenceCount)}
            aria-label={`${phaseEvidenceCount} evidence items recorded`}
          />
          <p>
            <LockKeyhole aria-hidden="true" /> Evidence creates an immutable artifact
            revision and a source-linked Atlas node. Only a person can approve a gate.
          </p>
        </aside>

        <div className={styles.actions}>
          <p role="status" aria-live="polite">{notice}</p>
          <button type="submit" disabled={disabled || submitting || (mode === "file" && !file)}>
            {submitting ? "Reading locally…" : "Record evidence in Atlas"}
          </button>
        </div>
      </form>
    </section>
  );
}
