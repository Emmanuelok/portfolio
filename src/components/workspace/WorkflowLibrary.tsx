"use client";

import {
  ArrowRight,
  Blocks,
  BookOpenCheck,
  Building2,
  Calculator,
  Check,
  FileOutput,
  MonitorSmartphone,
  Network,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
  isWorkflowTemplateId,
  workflowTemplateById,
  workflowTemplates,
  type WorkflowTemplateId,
} from "@/lib/workspace/workflow-templates";

import styles from "./WorkflowLibrary.module.css";

const templateIcons = {
  websites: MonitorSmartphone,
  "digital-tools": Calculator,
  "institutional-systems": Building2,
  "research-ai-tools": Network,
  "operational-tools": Blocks,
  "education-tools": BookOpenCheck,
  "personal-tools": UsersRound,
} as const;

export type WorkflowLibraryProps = Readonly<{
  disabled?: boolean;
  currentTemplateId?: WorkflowTemplateId | null;
  headingLevel?: "h2" | "h3";
  onStart: (templateId: WorkflowTemplateId, projectTitle: string) => void;
}>;

function workflowFromLocation() {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#workflow-/, "");
  return isWorkflowTemplateId(hash) ? hash : null;
}

function subscribeToLocationHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

export function WorkflowLibrary({
  disabled = false,
  currentTemplateId = null,
  headingLevel = "h2",
  onStart,
}: WorkflowLibraryProps) {
  const requestedTemplateId = useSyncExternalStore(
    subscribeToLocationHash,
    workflowFromLocation,
    () => null,
  );
  const [selectedOverride, setSelectedOverride] = useState<WorkflowTemplateId | null>(null);
  const selectedId = selectedOverride
    ?? requestedTemplateId
    ?? currentTemplateId
    ?? workflowTemplates[0].id;
  const selected = useMemo(() => workflowTemplateById(selectedId), [selectedId]);
  const [projectTitles, setProjectTitles] = useState<Partial<Record<WorkflowTemplateId, string>>>({});
  const projectTitle = projectTitles[selectedId] ?? selected.projectTitle;
  const Heading = headingLevel;

  const selectTemplate = (templateId: WorkflowTemplateId) => {
    setSelectedOverride(templateId);
  };

  const minimumEvidence = selected.phases.reduce(
    (total, phase) => total + phase.evidence.minimumItems,
    0,
  );

  return (
    <section
      className={styles.library}
      id="workflow-library"
      aria-labelledby="workflow-library-heading"
      data-workflow-library
    >
      <header className={styles.heading}>
        <div>
          <span>Atlas workflow library · Seven connected project types</span>
          <Heading id="workflow-library-heading">Start with a governed project structure.</Heading>
        </div>
        <p>
          Each workflow creates one local Atlas project with six connected phases,
          working artifacts, evidence thresholds, human gates, deliverables, and
          export targets. It does not start an AI review or send project content.
        </p>
      </header>

      <div className={styles.layout}>
        <nav className={styles.templateList} aria-label="Atlas workflow templates">
          {workflowTemplates.map((template) => {
            const Icon = templateIcons[template.id];
            const selectedTemplate = template.id === selectedId;
            return (
              <button
                id={`workflow-${template.id}`}
                type="button"
                aria-pressed={selectedTemplate}
                onClick={() => selectTemplate(template.id)}
                key={template.id}
              >
                <span>{template.index}</span>
                <Icon aria-hidden="true" />
                <strong>{template.name}</strong>
                {selectedTemplate ? <Check aria-hidden="true" /> : null}
              </button>
            );
          })}
        </nav>

        <article className={styles.detail} aria-live="polite">
          <div className={styles.detailLead}>
            <span>{selected.index} · {selected.shortName}</span>
            <h3>{selected.thesis}</h3>
            <p>{selected.projectSummary}</p>
          </div>

          <div className={styles.metrics}>
            <div><strong>06</strong><span>connected phases</span></div>
            <div><strong>{String(minimumEvidence).padStart(2, "0")}</strong><span>minimum evidence items</span></div>
            <div><strong>{String(selected.phases.length).padStart(2, "0")}</strong><span>human gates</span></div>
            <div><strong>{String(selected.exportTargets.length).padStart(2, "0")}</strong><span>project-level exports</span></div>
          </div>

          <ol className={styles.phaseList} aria-label={`${selected.name} workflow phases`}>
            {selected.phases.map((phase, index) => (
              <li key={phase.phase}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{phase.phase}</strong>
                  <small>{phase.artifact.title}</small>
                </div>
                <div>
                  <ShieldCheck aria-hidden="true" />
                  <small>{phase.evidence.minimumItems} evidence · human gate</small>
                </div>
              </li>
            ))}
          </ol>

          <div className={styles.startPanel}>
            <label htmlFor="workflow-project-title">
              <span>Project title</span>
              <input
                id="workflow-project-title"
                value={projectTitle}
                maxLength={120}
                onChange={(event) => setProjectTitles((current) => ({
                  ...current,
                  [selectedId]: event.target.value,
                }))}
              />
            </label>
            <button
              type="button"
              disabled={disabled || !projectTitle.trim()}
              onClick={() => onStart(selected.id, projectTitle.trim())}
            >
              Start as a new Atlas project
              <ArrowRight aria-hidden="true" />
            </button>
            <p>
              <FileOutput aria-hidden="true" /> Local project package, evidence record,
              and workflow-specific delivery outputs remain available for export.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
