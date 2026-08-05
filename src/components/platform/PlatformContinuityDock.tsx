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
  PLATFORM_LIFECYCLE,
  getPlatformPhase,
} from "@/lib/platform/registry";
import {
  PLATFORM_CHANGE_EVENT,
  PLATFORM_STORAGE_KEY,
  loadPlatformSidecar,
} from "@/lib/platform/storage";
import {
  LEGACY_WORKSPACE_STORAGE_KEY,
  WORKSPACE_STORAGE_KEY,
  loadWorkspaceLibrary,
} from "@/lib/workspace/storage";

import styles from "./PlatformContinuityDock.module.css";

const EMPTY_SNAPSHOT = "server";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(PLATFORM_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(PLATFORM_CHANGE_EVENT, onStoreChange);
  };
}

function getSnapshot() {
  try {
    return [
      window.localStorage.getItem(WORKSPACE_STORAGE_KEY) ?? "",
      window.localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY) ?? "",
      window.localStorage.getItem(PLATFORM_STORAGE_KEY) ?? "",
    ].join("\u0000");
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
    if (snapshot === EMPTY_SNAPSHOT || snapshot === "unavailable") return null;
    const workspace = loadWorkspaceLibrary(window.localStorage);
    if (workspace.status !== "ready") return null;
    const project = workspace.library.projects.find(
      (item) => item.id === workspace.library.activeProjectId,
    );
    if (!project) return null;
    const platform = loadPlatformSidecar(window.localStorage);
    const intelligence =
      platform.status === "error"
        ? null
        : platform.sidecar.projects[project.id] ?? null;
    return {
      project,
      intelligence,
      projects: workspace.library.projects.slice(0, 3),
    };
  }, [snapshot]);

  if (pathname.startsWith("/create")) return null;

  const expanded = expandedPath === pathname;
  const phase = getPlatformPhase(data?.intelligence?.phase ?? "discover") ??
    PLATFORM_LIFECYCLE[0];

  if (!data) {
    return (
      <aside className={styles.empty} aria-label="Start a Kingxford project">
        <Link href="/create/workspace?phase=discover&mode=idea">
          <span className={styles.emptyIcon}><Plus aria-hidden="true" /></span>
          <span>
            <small>Project intelligence</small>
            <strong>Start one continuing project</strong>
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
          <small>Active project · {phase.label}</small>
          <strong>{data.project.title || "Untitled project"}</strong>
        </span>
        <span className={styles.triggerMetrics}>
          <i>{data.intelligence?.evidence.length ?? 0} evidence</i>
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
                {data.intelligence?.objective ||
                  "Open the workspace to define the objective this project must preserve."}
              </p>
            </div>
            <Link href="/create/workspace">
              Open project
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </header>

          <div className={styles.metrics}>
            <span><FileSearch aria-hidden="true" /><strong>{data.intelligence?.evidence.length ?? 0}</strong><small>Evidence</small></span>
            <span><CheckCircle2 aria-hidden="true" /><strong>{data.intelligence?.decisions.length ?? 0}</strong><small>Decisions</small></span>
            <span><Sparkles aria-hidden="true" /><strong>{data.intelligence?.agentRuns.length ?? 0}</strong><small>Accepted runs</small></span>
            <span><GitCommitHorizontal aria-hidden="true" /><strong>{data.project.versions.length}</strong><small>Versions</small></span>
          </div>

          <div className={styles.phaseHeading}>
            <span><Database aria-hidden="true" /> Project lifecycle</span>
            <small>{phase.outcome}</small>
          </div>
          <nav className={styles.phases} aria-label="Continue active project by phase">
            {PLATFORM_LIFECYCLE.map((item) => (
              <Link
                data-active={item.id === phase.id ? "true" : "false"}
                href={item.route}
                key={item.id}
              >
                <small>{item.index}</small>
                <strong>{item.label}</strong>
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
