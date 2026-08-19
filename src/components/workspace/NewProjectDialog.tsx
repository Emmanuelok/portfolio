"use client";

import { Compass, FilePlus2, Route, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { PROJECT_GRAPH_LIMITS } from "@/lib/workspace/project-graph";
import type { WorkspaceMode } from "@/lib/workspace/types";
import {
  workflowTemplates,
  type WorkflowTemplateId,
} from "@/lib/workspace/workflow-templates";

import styles from "./NewProjectDialog.module.css";

export type NewProjectStartingPoint =
  | Readonly<{ kind: "blank"; mode: WorkspaceMode }>
  | Readonly<{ kind: "workflow"; templateId: WorkflowTemplateId }>;

export type NewProjectDetails = Readonly<{
  title: string;
  objective: string;
  startingPoint: NewProjectStartingPoint;
}>;

export type NewProjectDialogProps = Readonly<{
  open: boolean;
  projectCount: number;
  maxProjects: number;
  submitError?: string;
  onClose: () => void;
  onCreate: (details: NewProjectDetails) => boolean | void;
}>;

const PROJECT_TITLE_INPUT_LIMIT = 120;

const blankStarts: ReadonlyArray<
  Readonly<{ mode: WorkspaceMode; label: string; detail: string }>
> = [
  { mode: "idea", label: "Idea", detail: "Start at Discover with a written intention." },
  { mode: "mindmap", label: "System map", detail: "Start at Model with relationships and dependencies." },
  { mode: "prompt", label: "Prompt", detail: "Start at Build with a prompt to test." },
  { mode: "code", label: "Code prototype", detail: "Start at Build with a working front-end." },
  { mode: "brief", label: "Delivery brief", detail: "Start at Deliver with a handoff to shape." },
];

export function NewProjectDialog({
  open,
  projectCount,
  maxProjects,
  submitError,
  onClose,
  onCreate,
}: NewProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const objectiveRef = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [origin, setOrigin] = useState<"blank" | "workflow">("blank");
  const [mode, setMode] = useState<WorkspaceMode>("idea");
  const [templateId, setTemplateId] = useState<WorkflowTemplateId>(
    workflowTemplates[0].id,
  );
  const [titleTouched, setTitleTouched] = useState(false);
  const [objectiveTouched, setObjectiveTouched] = useState(false);
  const [error, setError] = useState<Readonly<{ field: "title" | "objective"; message: string }> | null>(null);
  const pointerDownInside = useRef(false);

  // The parent remounts this dialog on every opening, so the form starts clean
  // without resetting state from an effect. The name field takes focus because
  // it is the one required answer.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    // Opening from the project library closes that dialog in the same batch,
    // and its close moves focus, so the name field is claimed a frame later.
    // Scheduling outside the showModal branch keeps it working when the effect
    // is invoked twice and the dialog is already open on the second pass.
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const atLimit = projectCount >= maxProjects;
  const selectedTemplate =
    workflowTemplates.find((template) => template.id === templateId) ??
    workflowTemplates[0];

  const chooseTemplate = (nextId: WorkflowTemplateId) => {
    setTemplateId(nextId);
    setOrigin("workflow");
    setError(null);
    // A template carries a working title and objective; each fills its field
    // only while the person has not written their own there.
    const template = workflowTemplates.find(({ id }) => id === nextId);
    if (!template) return;
    if (!titleTouched) setTitle(template.projectTitle);
    if (!objectiveTouched) setObjective(template.projectSummary);
  };

  // Arrow keys move between the options of a radiogroup, which is what a
  // person using the keyboard expects once the roles claim one.
  const moveWithinGroup = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    values: readonly string[],
    current: string,
    select: (next: string) => void,
  ) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = values.indexOf(current);
    const next = values[(index + step + values.length) % values.length];
    select(next);
    const group = event.currentTarget;
    const target = group.querySelector<HTMLButtonElement>(
      `[data-value="${next}"]`,
    );
    target?.focus();
  };

  const submit = () => {
    const trimmedTitle = title.trim();
    const trimmedObjective = objective.trim();
    if (!trimmedTitle) {
      setError({
        field: "title",
        message: "Name this project so you can tell it apart from the others.",
      });
      titleRef.current?.focus();
      return;
    }
    if (!trimmedObjective) {
      setError({
        field: "objective",
        message:
          "State what this project must achieve. Review and the council read this to do anything useful.",
      });
      objectiveRef.current?.focus();
      return;
    }
    if (atLimit) {
      setError({
        field: "title",
        message: `This device holds the maximum of ${maxProjects} projects. Export or delete one to make room.`,
      });
      return;
    }
    onCreate({
      title: trimmedTitle.slice(0, PROJECT_GRAPH_LIMITS.titleCharacters),
      objective: trimmedObjective.slice(0, PROJECT_GRAPH_LIMITS.summaryCharacters),
      startingPoint:
        origin === "workflow"
          ? { kind: "workflow", templateId }
          : { kind: "blank", mode },
    });
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={`${fieldId}-title`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onPointerDown={(event) => {
        pointerDownInside.current = event.target !== event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pointerDownInside.current) {
          onClose();
        }
        pointerDownInside.current = false;
      }}
    >
      <form
        className={styles.card}
        // required stays for assistive technology; validation is handled here
        // so both fields report through the same styled message.
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <header className={styles.heading}>
          <div>
            <span>
              New project · {projectCount} of {maxProjects} on this device
            </span>
            <h2 id={`${fieldId}-title`}>Describe what you are making.</h2>
            <p>
              The name and objective are carried into every phase, review, and
              council session. Both can be changed later.
            </p>
          </div>
          <button type="button" aria-label="Close new project" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.field}>
            <label htmlFor={`${fieldId}-name`}>Project name</label>
            <input
              id={`${fieldId}-name`}
              ref={titleRef}
              value={title}
              maxLength={PROJECT_TITLE_INPUT_LIMIT}
              autoComplete="off"
              spellCheck={false}
              placeholder="Safe science lab planner"
              required
              aria-describedby={`${fieldId}-error`}
              aria-invalid={error?.field === "title" ? true : undefined}
              onChange={(event) => {
                setTitle(event.target.value);
                setTitleTouched(true);
                setError(null);
              }}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor={`${fieldId}-objective`}>
              What must this project achieve?
            </label>
            <textarea
              id={`${fieldId}-objective`}
              ref={objectiveRef}
              value={objective}
              rows={3}
              maxLength={PROJECT_GRAPH_LIMITS.summaryCharacters}
              required
              aria-describedby={`${fieldId}-hint ${fieldId}-error`}
              aria-invalid={error?.field === "objective" ? true : undefined}
              placeholder="State the outcome, who it is for, and the condition that would make it a success."
              onChange={(event) => {
                setObjective(event.target.value);
                setObjectiveTouched(true);
                setError(null);
              }}
            />
            <p className={styles.hint} id={`${fieldId}-hint`}>
              <span>
                Review and the advancement council read this as the project
                objective, so one specific sentence is worth more than a general
                one.
              </span>
              <small>
                {objective.length.toLocaleString()} /{" "}
                {PROJECT_GRAPH_LIMITS.summaryCharacters.toLocaleString()}
              </small>
            </p>
          </div>

          <fieldset className={styles.origin}>
            <legend>Starting point</legend>
            <div className={styles.originTabs}>
              <button
                type="button"
                aria-pressed={origin === "blank"}
                data-active={origin === "blank"}
                onClick={() => setOrigin("blank")}
              >
                <FilePlus2 aria-hidden="true" /> Blank workspace
              </button>
              <button
                type="button"
                aria-pressed={origin === "workflow"}
                data-active={origin === "workflow"}
                onClick={() => chooseTemplate(templateId)}
              >
                <Route aria-hidden="true" /> Guided workflow
              </button>
            </div>

            {origin === "blank" ? (
              <div
                className={styles.modes}
                role="radiogroup"
                aria-label="Blank starting artifact"
                onKeyDown={(event) =>
                  moveWithinGroup(
                    event,
                    blankStarts.map((start) => start.mode),
                    mode,
                    (next) => setMode(next as WorkspaceMode),
                  )
                }
              >
                {blankStarts.map((start) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={mode === start.mode}
                    data-active={mode === start.mode}
                    data-value={start.mode}
                    tabIndex={mode === start.mode ? 0 : -1}
                    key={start.mode}
                    onClick={() => setMode(start.mode)}
                  >
                    <strong>{start.label}</strong>
                    <span>{start.detail}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div
                className={styles.templates}
                role="radiogroup"
                aria-label="Guided workflow"
                onKeyDown={(event) =>
                  moveWithinGroup(
                    event,
                    workflowTemplates.map((template) => template.id),
                    templateId,
                    (next) => chooseTemplate(next as WorkflowTemplateId),
                  )
                }
              >
                {workflowTemplates.map((template) => (
                  <button
                    type="button"
                    role="radio"
                    aria-checked={templateId === template.id}
                    data-active={templateId === template.id}
                    data-value={template.id}
                    tabIndex={templateId === template.id ? 0 : -1}
                    key={template.id}
                    onClick={() => chooseTemplate(template.id)}
                  >
                    <small>{template.index}</small>
                    <strong>{template.shortName}</strong>
                    <span>{template.thesis}</span>
                  </button>
                ))}
              </div>
            )}

            <p className={styles.originNote}>
              <Compass aria-hidden="true" />
              {origin === "workflow"
                ? `${selectedTemplate.name} opens with ${selectedTemplate.phases.length} phases, each carrying its own gate criteria and evidence rule.`
                : `This opens one ${blankStarts.find((start) => start.mode === mode)?.label.toLocaleLowerCase("en")} artifact. Every phase stays available.`}
            </p>
          </fieldset>
        </div>

        <footer className={styles.footer}>
          <p className={styles.status} role="alert" id={`${fieldId}-error`}>
            {error || submitError ? (
              <span className={styles.error}>{error?.message || submitError}</span>
            ) : (
              <span>Stored on this device. Nothing is uploaded.</span>
            )}
          </p>
          <div>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" data-primary="true" disabled={atLimit}>
              Create project
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
