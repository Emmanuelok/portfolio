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

import { transformLabels } from "@/lib/workspace/presets";
import type { WorkspaceProject } from "@/lib/workspace/types";

import styles from "./ProjectLibraryDialog.module.css";

type ProjectLibraryDialogProps = Readonly<{
  open: boolean;
  projects: readonly WorkspaceProject[];
  activeProjectId: string;
  projectLimit: number;
  onClose: () => void;
  onCreate: () => void;
  onOpen: (projectId: string) => void;
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

export function ProjectLibraryDialog({
  open,
  projects,
  activeProjectId,
  projectLimit,
  onClose,
  onCreate,
  onOpen,
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

  const atLimit = projects.length >= projectLimit;
  const closeLibrary = () => {
    setConfirmDeleteId(null);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="project-library-title"
      onCancel={(event) => {
        event.preventDefault();
        closeLibrary();
      }}
      onClose={closeLibrary}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeLibrary();
      }}
    >
      <div className={styles.card}>
        <header className={styles.heading}>
          <div>
            <span>Local project library</span>
            <h2 id="project-library-title">Your Canvas workspaces</h2>
            <p>
              Keep separate ideas, prototypes and briefs without one project
              overwriting another.
            </p>
          </div>
          <button type="button" aria-label="Close project library" onClick={closeLibrary}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={styles.libraryToolbar}>
          <div>
            <strong>{projects.length} / {projectLimit}</strong>
            <span>projects stored on this device</span>
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
              aria-label="Import a Kingxford Canvas project bundle"
              accept=".kxcanvas.json,.json,application/json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
        </div>

        <ol className={styles.projectList}>
          {projects.map((project) => {
            const active = project.id === activeProjectId;
            const confirming = confirmDeleteId === project.id;
            return (
              <li key={project.id} data-active={active}>
                <div className={styles.projectMark}>
                  <FolderKanban aria-hidden="true" />
                  {active ? <span>Open</span> : null}
                </div>
                <section>
                  <div>
                    <span>{transformLabels[project.mode]}</span>
                    <small>{project.versions.length} versions</small>
                  </div>
                  <h3>{project.title || "Untitled Canvas project"}</h3>
                  <p>Updated {formatUpdated(project.updatedAt)}</p>
                </section>
                <div className={styles.projectActions}>
                  <button
                    type="button"
                    disabled={active}
                    onClick={() => onOpen(project.id)}
                  >
                    {active ? "Current" : "Open"}
                  </button>
                  <button
                    type="button"
                    title="Duplicate project"
                    aria-label={`Duplicate ${project.title || "untitled project"}`}
                    disabled={atLimit}
                    onClick={() => onDuplicate(project.id)}
                  >
                    <Copy aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title="Export project bundle"
                    aria-label={`Export ${project.title || "untitled project"}`}
                    onClick={() => onExport(project.id)}
                  >
                    <Download aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={confirming ? styles.deleteConfirm : undefined}
                    disabled={projects.length === 1}
                    aria-label={
                      confirming
                        ? `Confirm deletion of ${project.title || "untitled project"}`
                        : `Delete ${project.title || "untitled project"}`
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
            Project bundles use <code>.kxcanvas.json</code> so they can be
            backed up or moved to another browser without flattening the source.
          </p>
          <span>Nothing is uploaded by this library.</span>
        </footer>
      </div>
    </dialog>
  );
}
