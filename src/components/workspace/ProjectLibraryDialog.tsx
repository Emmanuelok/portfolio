"use client";

import {
  Copy,
  Download,
  FileUp,
  FolderKanban,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PLATFORM_PHASES } from "@/lib/platform";
import type { KingxfordProject } from "@/lib/workspace/project-graph";
import { PROJECT_REPOSITORY_MAX_PROJECTS } from "@/lib/workspace/project-repository";

import styles from "./ProjectLibraryDialog.module.css";

export type ProjectLibraryDialogProps = Readonly<{
  open: boolean;
  projects: readonly KingxfordProject[];
  activeProjectId: string | null;
  onClose: () => void;
  onCreate: () => void;
  onSelect: (projectId: string) => void;
  onDuplicate: (projectId: string) => void;
  onExport: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onImport: (file: File) => void;
}>;

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const phaseLabels = Object.fromEntries(
  PLATFORM_PHASES.map((phase) => [phase.id, phase.title]),
) as Record<KingxfordProject["activePhase"], string>;

function originLabel(project: KingxfordProject) {
  if (project.origin.kind === "canvas-v1-migration") return "Migrated from Canvas v1";
  if (project.origin.kind === "import-clone") return "Source lineage retained";
  return "Created in Atlas";
}

export function ProjectLibraryDialog({
  open,
  projects,
  activeProjectId,
  onClose,
  onCreate,
  onSelect,
  onDuplicate,
  onExport,
  onDelete,
  onImport,
}: ProjectLibraryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const atLimit = projects.length >= PROJECT_REPOSITORY_MAX_PROJECTS;
  const requestClose = () => {
    setConfirmDeleteId(null);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="project-library-title"
      aria-describedby="project-library-description"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClose={() => setConfirmDeleteId(null)}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className={styles.card}>
        <header className={styles.heading}>
          <div>
            <span>Atlas project library</span>
            <h2 id="project-library-title">Your connected intelligence</h2>
            <p id="project-library-description">
              Re-enter any project with its artifacts, evidence, decisions,
              graph relationships, and review provenance intact.
            </p>
          </div>
          <button type="button" aria-label="Close project library" onClick={requestClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={styles.libraryToolbar}>
          <div className={styles.limitStatus} data-limit={atLimit} aria-live="polite">
            <strong>
              {projects.length} / {PROJECT_REPOSITORY_MAX_PROJECTS}
            </strong>
            <span>
              {atLimit
                ? "20-project limit reached · export or delete one to make room"
                : "complete Atlas projects stored on this device"}
            </span>
          </div>
          <div>
            <button type="button" disabled={atLimit} onClick={onCreate}>
              <Plus aria-hidden="true" />
              New project
            </button>
            <button type="button" disabled={atLimit} onClick={() => fileInputRef.current?.click()}>
              <FileUp aria-hidden="true" />
              Import project
            </button>
            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              aria-label="Import a complete Kingxford project bundle"
              accept=".kxproject.json,.kxcanvas.json,.json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        <ol className={styles.projectList}>
          {projects.length === 0 ? (
            <li className={styles.emptyState}>
              <FolderKanban aria-hidden="true" />
              <div>
                <h3>Start your first Atlas project</h3>
                <p>
                  Every phase, artifact, decision, and revision will stay
                  connected here as the work develops.
                </p>
              </div>
              <button type="button" onClick={onCreate}>
                <Plus aria-hidden="true" />
                New project
              </button>
            </li>
          ) : null}
          {projects.map((project) => {
            const active = project.id === activeProjectId;
            const confirming = confirmDeleteId === project.id;
            const evidenceCount = project.artifacts.filter(
              ({ kind }) => kind === "evidence",
            ).length;
            const decidedGateCount = project.gates.filter(
              ({ status }) => status !== "open",
            ).length;
            return (
              <li key={project.id} data-active={active}>
                <div className={styles.projectMark}>
                  <FolderKanban aria-hidden="true" />
                  {active ? <span>Open</span> : null}
                </div>
                <section>
                  <div className={styles.projectMeta}>
                    <span>{phaseLabels[project.activePhase]} phase</span>
                    <small>
                      {project.artifacts.length} artifacts · {project.revisions.length} revisions
                    </small>
                  </div>
                  <h3>{project.title}</h3>
                  <p className={styles.projectSummary}>
                    {project.summary || "A connected Atlas project ready for its next move."}
                  </p>
                  <div className={styles.projectSignals}>
                    <span>{evidenceCount} evidence</span>
                    <span>{decidedGateCount} / {project.gates.length} gates decided</span>
                    <span>{originLabel(project)}</span>
                    <time dateTime={project.updatedAt}>
                      Updated {formatUpdated(project.updatedAt)}
                    </time>
                  </div>
                </section>
                <div className={styles.projectActions}>
                  <button
                    type="button"
                    disabled={active}
                    onClick={() => {
                      setConfirmDeleteId(null);
                      onSelect(project.id);
                    }}
                  >
                    {active ? "Current" : "Select"}
                  </button>
                  <button
                    type="button"
                    title="Duplicate project"
                    aria-label={`Duplicate ${project.title}`}
                    disabled={atLimit}
                    onClick={() => {
                      setConfirmDeleteId(null);
                      onDuplicate(project.id);
                    }}
                  >
                    <Copy aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title="Export project bundle"
                    aria-label={`Export ${project.title}`}
                    onClick={() => {
                      setConfirmDeleteId(null);
                      onExport(project.id);
                    }}
                  >
                    <Download aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={confirming ? styles.deleteConfirm : undefined}
                    disabled={projects.length === 1}
                    aria-label={
                      confirming
                        ? `Confirm deletion of ${project.title}`
                        : `Delete ${project.title}`
                    }
                    title={confirming ? "Click again to confirm deletion" : "Delete project"}
                    onClick={() => {
                      if (confirming) {
                        setConfirmDeleteId(null);
                        onDelete(project.id);
                      } else {
                        setConfirmDeleteId(project.id);
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    {confirming ? <span>Confirm</span> : null}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>

        <footer>
          <p>
            Complete <code>.kxproject.json</code> bundles preserve editable
            artifacts, immutable revisions, evidence, decisions, graph layout,
            and accepted Agent provenance.
          </p>
          <span>Private on this device until you choose to export.</span>
        </footer>
      </div>
    </dialog>
  );
}
