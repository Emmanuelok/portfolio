"use client";

import {
  Check,
  CircleDashed,
  GitCommitHorizontal,
  LockKeyhole,
  MessagesSquare,
  Network,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import {
  type KeyboardEvent,
  useRef,
  useState,
} from "react";

import styles from "@/components/workspace/ProjectContinuum.module.css";
import {
  PLATFORM_CONDUCTOR,
  PLATFORM_PHASES,
  type PlatformPhaseId,
} from "@/lib/platform";

export type ContinuumPhaseStatus = "not-started" | "active" | "review" | "complete";

export type ContinuumPhaseState = Readonly<{
  status?: ContinuumPhaseStatus;
  known?: number;
  unresolved?: number;
}>;

export type ContinuumLineageItem = Readonly<{
  id: string;
  label: string;
  source: string;
  revision?: string;
}>;

type ProjectContinuumProps = Readonly<{
  activePhase?: PlatformPhaseId;
  phaseState?: Partial<Record<PlatformPhaseId, ContinuumPhaseState>>;
  knownCount?: number;
  unresolvedCount?: number;
  lineage?: readonly ContinuumLineageItem[];
  artifactLabel?: string;
  onPhaseChange?: (phase: PlatformPhaseId) => void;
  onAskSpecialist?: (phase: PlatformPhaseId) => void;
  onAdvanceGate?: (phase: PlatformPhaseId) => void;
}>;

const statusLabels: Record<ContinuumPhaseStatus, string> = {
  "not-started": "Not started",
  active: "In progress",
  review: "Human review",
  complete: "Complete",
};

const EMPTY_PHASE_STATE: Partial<
  Record<PlatformPhaseId, ContinuumPhaseState>
> = {};
const EMPTY_LINEAGE: readonly ContinuumLineageItem[] = [];

function numberOrZero(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

export function ProjectContinuum({
  activePhase,
  phaseState = EMPTY_PHASE_STATE,
  knownCount,
  unresolvedCount,
  lineage = EMPTY_LINEAGE,
  artifactLabel = "No artifact revision selected",
  onPhaseChange,
  onAskSpecialist,
  onAdvanceGate,
}: ProjectContinuumProps) {
  const [internalPhase, setInternalPhase] = useState<PlatformPhaseId>("discovery");
  const selectedPhase = activePhase ?? internalPhase;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectPhase = (phaseId: PlatformPhaseId, focus = false) => {
    setInternalPhase(phaseId);
    onPhaseChange?.(phaseId);
    if (focus) {
      const phaseIndex = PLATFORM_PHASES.findIndex((phase) => phase.id === phaseId);
      tabRefs.current[phaseIndex]?.focus();
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    phaseIndex: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (phaseIndex + 1) % PLATFORM_PHASES.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (phaseIndex - 1 + PLATFORM_PHASES.length) % PLATFORM_PHASES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = PLATFORM_PHASES.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    selectPhase(PLATFORM_PHASES[nextIndex].id, true);
  };

  const selected =
    PLATFORM_PHASES.find((phase) => phase.id === selectedPhase) ?? PLATFORM_PHASES[0];
  const selectedState = phaseState[selected.id] ?? {};
  const totalKnown =
    typeof knownCount === "number"
      ? numberOrZero(knownCount)
      : PLATFORM_PHASES.reduce(
          (sum, phase) => sum + numberOrZero(phaseState[phase.id]?.known),
          0,
        );
  const totalUnresolved =
    typeof unresolvedCount === "number"
      ? numberOrZero(unresolvedCount)
      : PLATFORM_PHASES.reduce(
          (sum, phase) => sum + numberOrZero(phaseState[phase.id]?.unresolved),
          0,
        );

  return (
    <section className={styles.continuum} aria-labelledby="project-atlas-title">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Project Atlas</span>
          <h2 id="project-atlas-title">One project. One traceable intelligence thread.</h2>
        </div>
        <div className={styles.conductor}>
          <Network aria-hidden="true" />
          <div>
            <strong>{PLATFORM_CONDUCTOR.name}</strong>
            <span>Coordinates proposals across every phase</span>
          </div>
        </div>
      </header>

      <div className={styles.signals} aria-label="Current Atlas signals">
        <div>
          <span>Known</span>
          <strong>{totalKnown}</strong>
          <small>grounded project signals</small>
        </div>
        <div>
          <span>Unresolved</span>
          <strong>{totalUnresolved}</strong>
          <small>questions kept visible</small>
        </div>
        <div>
          <span>Lineage</span>
          <strong>{lineage.length}</strong>
          <small>linked sources or revisions</small>
        </div>
        <div>
          <span>Active artifact</span>
          <strong className={styles.artifact}>{artifactLabel}</strong>
          <small>reviews bind to an exact revision</small>
        </div>
      </div>

      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Project phases"
        aria-orientation="horizontal"
      >
        {PLATFORM_PHASES.map((phase, index) => {
          const state = phaseState[phase.id] ?? {};
          const status = state.status ?? (phase.id === selectedPhase ? "active" : "not-started");
          const isSelected = phase.id === selectedPhase;
          return (
            <button
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              className={styles.tab}
              id={`atlas-tab-${phase.id}`}
              type="button"
              role="tab"
              aria-controls={`atlas-panel-${phase.id}`}
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              data-status={status}
              onClick={() => selectPhase(phase.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              key={phase.id}
            >
              <span className={styles.tabNumber}>{phase.number}</span>
              <span className={styles.tabTitle}>{phase.title}</span>
              <span className={styles.tabStatus}>
                {status === "complete" ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                {statusLabels[status]}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={styles.panel}
        id={`atlas-panel-${selected.id}`}
        role="tabpanel"
        aria-labelledby={`atlas-tab-${selected.id}`}
        tabIndex={0}
      >
        <div className={styles.panelLead}>
          <span>{selected.verb} / {selected.number}</span>
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
        </div>
        <dl className={styles.phaseSignals}>
          <div>
            <dt>Exit signal</dt>
            <dd>{selected.signal}</dd>
          </div>
          <div>
            <dt>Conductor routing</dt>
            <dd>{selected.conductor}</dd>
          </div>
        </dl>
        <div className={styles.gate}>
          <LockKeyhole aria-hidden="true" />
          <div>
            <span>Human gate</span>
            <p>{selected.gate}</p>
          </div>
          <span className={styles.gateState}>
            {selectedState.status === "complete" ? "Recorded" : "No automatic approval"}
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => onAskSpecialist?.(selected.id)}
            disabled={!onAskSpecialist}
          >
            <MessagesSquare aria-hidden="true" />
            Ask {selected.title} specialist
          </button>
          <button
            type="button"
            onClick={() => onAdvanceGate?.(selected.id)}
            disabled={!onAdvanceGate || selectedState.status !== "review"}
            aria-describedby={`atlas-gate-note-${selected.id}`}
          >
            <UserCheck aria-hidden="true" />
            Record human approval
          </button>
          <p id={`atlas-gate-note-${selected.id}`}>
            {selectedState.status === "review"
              ? "Approval records a person’s decision for this phase; it is never inferred from an AI response."
              : "The gate becomes available only after this phase enters human review."}
          </p>
        </div>
      </div>

      <div className={styles.lineage}>
        <div className={styles.lineageHeading}>
          <div>
            <GitCommitHorizontal aria-hidden="true" />
            <span>Lineage &amp; provenance</span>
          </div>
          <small>Source → project decision → artifact revision</small>
        </div>
        {lineage.length > 0 ? (
          <ol>
            {lineage.slice(0, 6).map((item) => (
              <li key={item.id}>
                <span>{item.source}</span>
                <strong>{item.label}</strong>
                <small>{item.revision ?? "Source evidence"}</small>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyLineage}>
            Provenance appears here when evidence or an artifact revision is added.
            The absence of lineage is shown honestly, not inferred.
          </p>
        )}
      </div>

      <p className={styles.boundary}>
        <ShieldCheck aria-hidden="true" />
        Conductor proposes and coordinates. People approve, publish, and remain accountable.
      </p>
    </section>
  );
}
