"use client";

import {
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSearch,
  GitCommitHorizontal,
  Layers3,
  Plus,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
  PLATFORM_PHASES,
  type PlatformPhaseId,
} from "@/lib/platform";
import {
  PROJECT_REPOSITORY_CHANGE_EVENT,
  PROJECT_REPOSITORY_STORAGE_KEY,
  activeRepositoryProject,
  loadProjectRepository,
} from "@/lib/workspace/project-repository";

import styles from "./PlatformContinuityDock.module.css";

const EMPTY_SNAPSHOT = "server";

const phaseModes: Readonly<Record<PlatformPhaseId, string>> = {
  discovery: "idea",
  evidence: "brief",
  systems: "mindmap",
  prototype: "code",
  validation: "brief",
  delivery: "brief",
};

function subscribe(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PROJECT_REPOSITORY_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(PROJECT_REPOSITORY_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PROJECT_REPOSITORY_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(PROJECT_REPOSITORY_STORAGE_KEY) ?? "";
  } catch {
    return "unavailable";
  }
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

export function PlatformContinuityDock() {
  const pathname = usePathname();
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const data = useMemo(() => {
    if (snapshot === EMPTY_SNAPSHOT) return { status: "pending" as const };
    if (snapshot === "unavailable") return { status: "error" as const };
    try {
      const repository = loadProjectRepository(window.localStorage);
      const project = activeRepositoryProject(repository);
      if (!project) return { status: "empty" as const };
      return {
        status: "ready" as const,
        project,
        projects: [...repository.projects]
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .slice(0, 3),
        evidenceCount: project.artifacts.filter(({ kind }) => kind === "evidence").length,
      };
    } catch {
      return { status: "error" as const };
    }
  }, [snapshot]);

  if (pathname.startsWith("/create")) return null;
  if (data.status === "pending") return null;

  const expanded = expandedPath === pathname;
  const phase = data.status === "ready"
    ? PLATFORM_PHASES.find(({ id }) => id === data.project.activePhase)
      ?? PLATFORM_PHASES[0]
    : PLATFORM_PHASES[0];

  if (data.status !== "ready") {
    const unavailable = data.status === "error";
    return (
      <aside className={styles.empty} aria-label="Start a Kingxford project">
        <Link href="/create/workspace?phase=discovery&mode=idea">
          <span className={styles.emptyIcon}><Plus aria-hidden="true" /></span>
          <span>
            <small>Project intelligence</small>
            <strong>
              {unavailable
                ? "Open Canvas to recover Project Atlas"
                : "Start one continuing project"}
            </strong>
          </span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </aside>
    );
  }

  return (
    <aside
      className={styles.dock}
      data-expanded={expanded ? "true" : "false"}
      aria-label="Active Kingxford project"
    >
      <button
        className={styles.trigger}
        type="button"
        aria-expanded={expanded}
        aria-controls="platform-continuity-panel"
        onClick={() => setExpandedPath(expanded ? null : pathname)}
      >
        <span className={styles.signal} aria-hidden="true"><i /></span>
        <span className={styles.triggerCopy}>
          <small>Active project · {phase.title}</small>
          <strong>{data.project.title || "Untitled project"}</strong>
        </span>
        <span className={styles.triggerMetrics}>
          <i>{data.evidenceCount} evidence</i>
          <ChevronDown aria-hidden="true" />
        </span>
      </button>

      {expanded ? (
        <div className={styles.panel} id="platform-continuity-panel">
          <header className={styles.panelHeader}>
            <div>
              <span><BrainCircuit aria-hidden="true" /> Project intelligence</span>
              <h2>{data.project.title || "Untitled project"}</h2>
              <p>
                {data.project.summary ||
                  "Open the workspace to define the objective this project must preserve."}
              </p>
            </div>
            <Link href="/create/workspace">
              Open project
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </header>

          <div className={styles.metrics}>
            <span><FileSearch aria-hidden="true" /><strong>{data.evidenceCount}</strong><small>Evidence</small></span>
            <span><CheckCircle2 aria-hidden="true" /><strong>{data.project.decisions.length}</strong><small>Decisions</small></span>
            <span><Sparkles aria-hidden="true" /><strong>{data.project.reviewLinks.length}</strong><small>Reviews</small></span>
            <span><GitCommitHorizontal aria-hidden="true" /><strong>{data.project.revisions.length}</strong><small>Revisions</small></span>
          </div>

          <div className={styles.phaseHeading}>
            <span><Database aria-hidden="true" /> Project lifecycle</span>
            <small>{phase.signal}</small>
          </div>
          <nav className={styles.phases} aria-label="Continue active project by phase">
            {PLATFORM_PHASES.map((item) => (
              <Link
                data-active={item.id === phase.id ? "true" : "false"}
                href={`/create/workspace?phase=${item.id}&mode=${phaseModes[item.id]}`}
                key={item.id}
              >
                <small>{item.number}</small>
                <strong>{item.title}</strong>
              </Link>
            ))}
          </nav>

          {data.projects.length > 1 ? (
            <div className={styles.recent}>
              <span><Layers3 aria-hidden="true" /> Local project library</span>
              <p>
                {data.projects.map((project) => project.title || "Untitled project").join(" · ")}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
