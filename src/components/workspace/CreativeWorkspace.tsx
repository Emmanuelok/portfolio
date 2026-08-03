"use client";

import {
  ArrowRight,
  Bot,
  Braces,
  ChevronRight,
  CircleStop,
  Code2,
  Download,
  FileUp,
  FileCode2,
  FileText,
  FolderKanban,
  GitCompare,
  History,
  Lightbulb,
  LoaderCircle,
  Network,
  PanelLeft,
  PanelRight,
  Play,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Sparkles,
  TriangleAlert,
  WandSparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  summarizeDraftChanges,
  transformDraft,
} from "@/lib/workspace/local-analysis";
import {
  initialDraft,
  modeDetails,
  starterText,
  transformLabels,
} from "@/lib/workspace/presets";
import {
  createWorkspaceLibrary,
  createWorkspaceProject,
  importWorkspaceProjectBundle,
  loadWorkspaceLibrary,
  saveWorkspaceLibrary,
  serializeWorkspaceProjectBundle,
  WORKSPACE_BUNDLE_CHARACTER_LIMIT,
  WORKSPACE_PROJECT_LIMIT,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_VERSION_LIMIT,
} from "@/lib/workspace/storage";
import type {
  AgentReviewResponse,
  CodeFiles,
  TextByMode,
  WorkspaceDraft,
  WorkspaceLibraryV2,
  WorkspaceMode,
  WorkspaceProject,
  WorkspaceProjectContent,
  WorkspaceVersion,
} from "@/lib/workspace/types";
import { workspaceModes } from "@/lib/workspace/types";

import { ProjectLibraryDialog } from "./ProjectLibraryDialog";
import { WorkspacePreview } from "./WorkspacePreview";
import styles from "./CreativeWorkspace.module.css";

type RightTab = "preview" | "agent" | "versions";
type MobilePane = "input" | "preview" | "agent" | "versions";
type CodeFileKey = keyof CodeFiles;

type CreativeWorkspaceProps = Readonly<{
  entrepreneurshipUrl: string | null;
  initialMode: WorkspaceMode | null;
}>;

const HANDOFF_KEY = "kingxford:canvas-handoff:v1";
const CREATIVE_INPUT_FILE_LIMIT = 1_000_000;
const EMPTY_CODE: CodeFiles = { html: "", css: "", javascript: "" };

const modeIcons = {
  idea: Lightbulb,
  code: Code2,
  mindmap: Network,
  prompt: Braces,
  brief: FileText,
} as const;

const reviewActions = [
  "Challenge the assumptions",
  "Improve the clarity",
  "Find failure points",
  "Test another audience",
  "Make this buildable",
  "Propose the next version",
] as const;

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cloneDraft(draft: WorkspaceDraft): WorkspaceDraft {
  return {
    ...draft,
    code: { ...draft.code },
  };
}

function draftFingerprint(draft: WorkspaceDraft) {
  return JSON.stringify([
    draft.mode,
    draft.title,
    draft.text,
    draft.code.html,
    draft.code.css,
    draft.code.javascript,
  ]);
}

function createInitialProjectContent(
  mode: WorkspaceMode = initialDraft.mode,
): WorkspaceProjectContent {
  return {
    mode,
    title: initialDraft.title,
    textByMode: {
      idea: starterText.idea,
      mindmap: starterText.mindmap,
      prompt: starterText.prompt,
      brief: starterText.brief,
    },
    code: { ...initialDraft.code },
    committedCode: { ...initialDraft.code },
    versions: [],
  };
}

function downloadTextFile(content: string, type: string, fileName: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function versionContextSource(version: WorkspaceVersion) {
  if (version.draft.mode !== "code") return version.draft.text.slice(0, 1800);
  return JSON.stringify(version.draft.code).slice(0, 1800);
}

function handleTabArrow<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  values: readonly T[],
  current: T,
  select: (value: T) => void,
  idForValue: (value: T) => string,
) {
  const currentIndex = values.indexOf(current);
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % values.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + values.length) % values.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = values.length - 1;
  } else {
    return;
  }
  event.preventDefault();
  const next = values[nextIndex];
  select(next);
  window.requestAnimationFrame(() => document.getElementById(idForValue(next))?.focus());
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function fileExtension(mode: WorkspaceMode) {
  if (mode === "code") return "html";
  if (mode === "mindmap") return "md";
  return "md";
}

function safeFileName(value: string) {
  return (
    value
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "kingxford-canvas"
  );
}

function buildCodeExport(code: CodeFiles) {
  const javascript = code.javascript.replaceAll("</script", "<\\/script");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kingxford Canvas prototype</title>
  <style>${code.css}</style>
</head>
<body>
${code.html}
<script>${javascript}</script>
</body>
</html>`;
}

function formatAgentModel(model: string) {
  return model
    .replace(/^openai\//, "")
    .replace(/^gpt-/i, "GPT-")
    .replace(/-sol$/i, " Sol");
}

function AgentReviewPanel({
  response,
  isRunning,
  error,
  instruction,
  depth,
  canReview,
  reviewIsCurrent,
  includeLogs,
  includeVersions,
  onInstruction,
  onDepth,
  onIncludeLogs,
  onIncludeVersions,
  onReview,
  onStop,
  onApply,
}: Readonly<{
  response: AgentReviewResponse | null;
  isRunning: boolean;
  error: string;
  instruction: string;
  depth: "standard" | "deep";
  canReview: boolean;
  reviewIsCurrent: boolean;
  includeLogs: boolean;
  includeVersions: boolean;
  onInstruction: (value: string) => void;
  onDepth: (value: "standard" | "deep") => void;
  onIncludeLogs: (value: boolean) => void;
  onIncludeVersions: (value: boolean) => void;
  onReview: (instruction?: string) => void;
  onStop: () => void;
  onApply: () => void;
}>) {
  const review = response?.review;

  return (
    <section className={styles.agentPanel} aria-labelledby="agent-panel-heading">
      <header className={styles.agentHeading}>
        <div className={styles.agentIdentity}>
          <span className={styles.agentMark}><Sparkles aria-hidden="true" /></span>
          <div>
            <span>Kingxford Agent</span>
            <h2 id="agent-panel-heading">Creative intelligence review</h2>
          </div>
        </div>
        <div className={styles.agentProtocol}>
          <span>
            {response?.source === "openai"
              ? formatAgentModel(response.model)
              : "GPT-5.6 Sol target"}
          </span>
          <small>Daily-evaluated protocol</small>
        </div>
      </header>

      <div className={styles.agentTruth}>
        <Bot aria-hidden="true" />
        <p>
          Capabilities are evaluated daily and released only after quality and
          safety checks. The Agent does not rewrite itself or learn from your
          private work.
        </p>
      </div>

      {!review && !isRunning && (
        <div className={styles.agentEmpty}>
          <span>Uses AI</span>
          <h3>Ask for a rigorous second view.</h3>
          <p>
            The Agent can challenge assumptions, expose failure points, refine
            the source and turn this version into a buildable brief.
          </p>
          <div className={styles.quickActions}>
            {reviewActions.map((action) => (
              <button
                type="button"
                disabled={!canReview}
                onClick={() => onReview(action)}
                key={action}
              >
                {action}
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {isRunning && (
        <div className={styles.agentRunning} role="status">
          <LoaderCircle aria-hidden="true" />
          <div>
            <strong>Examining this version…</strong>
            <span>Clarity · assumptions · feasibility · next test</span>
          </div>
          <button type="button" onClick={onStop}>
            <CircleStop aria-hidden="true" />
            Stop
          </button>
        </div>
      )}

      {error && <p className={styles.agentError} role="alert">{error}</p>}

      {review && !isRunning && (
        <div className={styles.reviewResult}>
          {!reviewIsCurrent ? (
            <div className={styles.staleReview} role="alert">
              <TriangleAlert aria-hidden="true" />
              <div className={styles.versionNumber}>
                <strong>This review belongs to an earlier source.</strong>
                <span>
                  Your current work is protected. Review the current version
                  before applying or attaching Agent changes.
                </span>
              </div>
            </div>
          ) : null}
          <div className={styles.reviewSummary}>
            <div>
              <span data-status={review.status}>{review.status}</span>
              <small>{response.source === "openai" ? "OpenAI review" : "Local structural review"}</small>
            </div>
            <p>{review.summary}</p>
          </div>

          {response.notice && <p className={styles.reviewNotice}>{response.notice}</p>}

          <div className={styles.reviewColumns}>
            <section>
              <span>What is working</span>
              <ul>{review.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section>
              <span>What remains unclear</span>
              <ul>{review.uncertainties.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section>
              <span>What may fail</span>
              <ul>{review.failurePoints.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section>
              <span>Assumptions without evidence</span>
              <ul>{review.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          </div>

          <section className={styles.nextTest}>
            <span>The next best test</span>
            <p>{review.nextTest}</p>
          </section>

          <section className={styles.proposedChanges}>
            <span>Proposed changes</span>
            <ol>
              {review.proposedChanges.map((change) => <li key={change}>{change}</li>)}
            </ol>
            <details>
              <summary>Inspect proposed source</summary>
              {review.improvedCode ? (
                <div className={styles.proposedCodeFiles}>
                  <section><span>HTML</span><pre>{review.improvedCode.html}</pre></section>
                  <section><span>CSS</span><pre>{review.improvedCode.css}</pre></section>
                  <section><span>JavaScript</span><pre>{review.improvedCode.javascript}</pre></section>
                </div>
              ) : (
                <pre>{review.improvedInput}</pre>
              )}
            </details>
            <button type="button" disabled={!reviewIsCurrent} onClick={onApply}>
              <WandSparkles aria-hidden="true" />
              {reviewIsCurrent ? "Apply as a new version" : "Review is out of date"}
            </button>
          </section>

          <section className={styles.buildBriefCard}>
            <div>
              <span>{review.buildBrief.complexity} build</span>
              <h3>{review.buildBrief.title}</h3>
              <p>{review.buildBrief.oneLine}</p>
            </div>
            <ul>
              {review.buildBrief.deliverables.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>
      )}

      <div className={styles.agentComposer}>
        <label htmlFor="agent-instruction">Ask the Agent to examine this version</label>
        <textarea
          id="agent-instruction"
          value={instruction}
          rows={3}
          placeholder="Challenge the assumptions and make the next test more rigorous…"
          onChange={(event) => onInstruction(event.target.value)}
        />
        <div className={styles.agentContext}>
          <div>
            <span>Choose what the Agent can see</span>
            <label><input type="checkbox" checked readOnly /> Current input</label>
            <label>
              <input
                type="checkbox"
                checked={includeLogs}
                onChange={(event) => onIncludeLogs(event.target.checked)}
              />
              Preview console
            </label>
            <label>
              <input
                type="checkbox"
                checked={includeVersions}
                onChange={(event) => onIncludeVersions(event.target.checked)}
              />
              Previous versions
            </label>
          </div>
          <div className={styles.depthControl} role="group" aria-label="Review depth">
            <button
              type="button"
              aria-pressed={depth === "standard"}
              onClick={() => onDepth("standard")}
            >
              Standard
            </button>
            <button
              type="button"
              aria-pressed={depth === "deep"}
              onClick={() => onDepth("deep")}
            >
              Deep
            </button>
          </div>
          <button
            className={styles.sendReview}
            type="button"
            disabled={!canReview || isRunning}
            onClick={() => onReview()}
          >
            <Send aria-hidden="true" />
            Review this version
          </button>
        </div>
        <p>
          Only the checked workspace context is sent when you press Review.
          Remove secrets or confidential material first.
        </p>
      </div>
    </section>
  );
}

function VersionPanel({
  versions,
  currentDraft,
  onSave,
  onRestore,
  onClear,
}: Readonly<{
  versions: readonly WorkspaceVersion[];
  currentDraft: WorkspaceDraft;
  onSave: () => void;
  onRestore: (version: WorkspaceVersion) => void;
  onClear: () => void;
}>) {
  const [comparisonId, setComparisonId] = useState<string | null>(null);

  return (
    <section className={styles.versionPanel} aria-labelledby="version-panel-heading">
      <header>
        <div>
          <span>Local revision history</span>
          <h2 id="version-panel-heading">Versions</h2>
        </div>
        <button type="button" onClick={onSave}>
          <Plus aria-hidden="true" />
          Save checkpoint
        </button>
      </header>
      <p className={styles.versionPrivacy}>
        Saved on this device. Restoring creates a new branch so the current
        version remains available.
      </p>
      {versions.length ? (
        <ol className={styles.versionList}>
          {versions.map((version, index) => (
            <li key={version.id}>
              <div>
                <span>V{String(versions.length - index).padStart(2, "0")}</span>
                <small>{transformLabels[version.draft.mode]}</small>
              </div>
              <section>
                <h3>{version.name}</h3>
                <p>{formatTime(version.createdAt)} · {version.source}</p>
              </section>
              <div className={styles.versionActions}>
                <button
                  type="button"
                  aria-pressed={comparisonId === version.id}
                  onClick={() => setComparisonId((current) => current === version.id ? null : version.id)}
                >
                  <GitCompare aria-hidden="true" />
                  Compare
                </button>
                <button type="button" onClick={() => onRestore(version)}>
                  <RotateCcw aria-hidden="true" />
                  Restore copy
                </button>
              </div>
              {comparisonId === version.id ? (
                <div className={styles.versionComparison}>
                  <span>Checkpoint → current source</span>
                  <ul>
                    {summarizeDraftChanges(version.draft, currentDraft).map((change) => (
                      <li key={change}>{change}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className={styles.versionEmpty}>
          <History aria-hidden="true" />
          <h3>No versions yet.</h3>
          <p>A checkpoint appears after your first run or approved Agent change.</p>
        </div>
      )}
      {versions.length > 0 && (
        <button className={styles.clearVersions} type="button" onClick={onClear}>
          Clear local history
        </button>
      )}
    </section>
  );
}

export function CreativeWorkspace({
  entrepreneurshipUrl,
  initialMode,
}: CreativeWorkspaceProps) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const handoffRef = useRef<HTMLDialogElement>(null);
  const creativeInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const draggingRef = useRef(false);
  const projectsRef = useRef<readonly WorkspaceProject[]>([]);
  const libraryRevisionRef = useRef(0);

  const [mode, setMode] = useState<WorkspaceMode>(initialMode ?? initialDraft.mode);
  const [title, setTitle] = useState(initialDraft.title);
  const [textByMode, setTextByMode] = useState<TextByMode>({
    idea: starterText.idea,
    mindmap: starterText.mindmap,
    prompt: starterText.prompt,
    brief: starterText.brief,
  });
  const [code, setCode] = useState<CodeFiles>(initialDraft.code);
  const [committedCode, setCommittedCode] = useState<CodeFiles>(initialDraft.code);
  const [codeFile, setCodeFile] = useState<CodeFileKey>("html");
  const [autoRun, setAutoRun] = useState(true);
  const [runId, setRunId] = useState(0);
  const [versions, setVersions] = useState<readonly WorkspaceVersion[]>([]);
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [mobilePane, setMobilePane] = useState<MobilePane>("input");
  const [paneWidth, setPaneWidth] = useState(51);
  const [status, setStatus] = useState("Preview current · Saved on this device");
  const [codeLogs, setCodeLogs] = useState<readonly string[]>([]);
  const [reviewResponse, setReviewResponse] = useState<AgentReviewResponse | null>(null);
  const [reviewDraftFingerprint, setReviewDraftFingerprint] = useState<string | null>(null);
  const [reviewInstruction, setReviewInstruction] = useState("");
  const [reviewDepth, setReviewDepth] = useState<"standard" | "deep">("deep");
  const [reviewError, setReviewError] = useState("");
  const [reviewRunning, setReviewRunning] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [includeVersions, setIncludeVersions] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [handoffAgent, setHandoffAgent] = useState(true);
  const [handoffVersions, setHandoffVersions] = useState(false);
  const [projects, setProjects] = useState<readonly WorkspaceProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [projectLibraryOpen, setProjectLibraryOpen] = useState(false);
  const [persistenceSuspended, setPersistenceSuspended] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const currentText = mode === "code" ? "" : textByMode[mode];
  const draft = useMemo<WorkspaceDraft>(
    () => ({ mode, title, text: currentText, code }),
    [code, currentText, mode, title],
  );
  const currentDraftFingerprint = useMemo(() => draftFingerprint(draft), [draft]);
  const reviewIsCurrent = Boolean(
    reviewResponse &&
      reviewDraftFingerprint === `${activeProjectId}:${currentDraftFingerprint}`,
  );
  const canReview = mode === "code"
    ? Boolean(code.html.trim() || code.css.trim() || code.javascript.trim())
    : currentText.trim().length > 2;
  const sourceLength = mode === "code"
    ? code.html.length + code.css.length + code.javascript.length
    : currentText.length;

  const replaceProjects = useCallback((nextProjects: readonly WorkspaceProject[]) => {
    projectsRef.current = nextProjects;
    setProjects(nextProjects);
  }, []);

  const loadProjectIntoEditor = useCallback(
    (project: WorkspaceProject, requestedMode?: WorkspaceMode | null) => {
      controllerRef.current?.abort();
      setMode(requestedMode ?? project.mode);
      setTitle(project.title);
      setTextByMode(project.textByMode);
      setCode(project.code);
      setCommittedCode(project.committedCode);
      setVersions(project.versions.slice(0, WORKSPACE_VERSION_LIMIT));
      setCodeFile("html");
      setCodeLogs([]);
      setReviewResponse(null);
      setReviewDraftFingerprint(null);
      setReviewError("");
      setReviewRunning(false);
      setRightTab("preview");
      setMobilePane("input");
      setRunId((value) => value + 1);
    },
    [],
  );

  const persistProjects = useCallback(
    (nextProjects: readonly WorkspaceProject[], nextActiveProjectId: string) => {
      if (persistenceSuspended) return false;
      const library: WorkspaceLibraryV2 = {
        schemaVersion: 2,
        revision: libraryRevisionRef.current + 1,
        activeProjectId: nextActiveProjectId,
        projects: nextProjects,
      };
      const result = saveWorkspaceLibrary(window.localStorage, library);
      if (!result.ok) {
        setStatus(`${result.error.message} Current edits remain open.`);
        return false;
      }
      libraryRevisionRef.current = library.revision;
      return true;
    },
    [persistenceSuspended],
  );

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    const hydrateFrame = window.requestAnimationFrame(() => {
      setIsOnline(navigator.onLine);
      const loaded = loadWorkspaceLibrary(window.localStorage);
      if (loaded.status === "ready") {
        const active = loaded.library.projects.find(
          (project) => project.id === loaded.library.activeProjectId,
        ) ?? loaded.library.projects[0];
        replaceProjects(loaded.library.projects);
        libraryRevisionRef.current = loaded.library.revision;
        setActiveProjectId(active.id);
        loadProjectIntoEditor(active, initialMode);
        if (loaded.needsPersistence) {
          const migrated = saveWorkspaceLibrary(window.localStorage, loaded.library);
          setStatus(
            migrated.ok
              ? "Previous Canvas work migrated into your project library"
              : `${migrated.error.message} Current edits remain open.`,
          );
        }
      } else if (loaded.status === "empty") {
        const project = createWorkspaceProject(
          createInitialProjectContent(initialMode ?? initialDraft.mode),
        );
        const library = createWorkspaceLibrary(project);
        replaceProjects(library.projects);
        libraryRevisionRef.current = library.revision;
        setActiveProjectId(project.id);
        loadProjectIntoEditor(project, initialMode);
        const saved = saveWorkspaceLibrary(window.localStorage, library);
        if (!saved.ok) setStatus(`${saved.error.message} Current edits remain open.`);
      } else {
        const project = createWorkspaceProject(
          createInitialProjectContent(initialMode ?? initialDraft.mode),
        );
        replaceProjects([project]);
        setActiveProjectId(project.id);
        loadProjectIntoEditor(project, initialMode);
        setPersistenceSuspended(true);
        setStatus(`${loaded.error.message} Autosave is paused to preserve the original data.`);
      }
      setHydrated(true);
    });

    return () => {
      window.cancelAnimationFrame(hydrateFrame);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [initialMode, loadProjectIntoEditor, replaceProjects]);

  useEffect(() => {
    if (!hydrated || !activeProjectId) return;
    const saveTimer = window.setTimeout(() => {
      const now = new Date().toISOString();
      const nextProjects = projectsRef.current.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              mode,
              title,
              textByMode,
              code: { ...code },
              committedCode: { ...committedCode },
              versions: versions.slice(0, WORKSPACE_VERSION_LIMIT),
              updatedAt: now,
            }
          : project,
      );
      replaceProjects(nextProjects);
      if (persistProjects(nextProjects, activeProjectId)) {
        setStatus("Saved on this device");
      }
    }, 180);
    return () => window.clearTimeout(saveTimer);
  }, [
    activeProjectId,
    code,
    committedCode,
    hydrated,
    mode,
    persistProjects,
    replaceProjects,
    textByMode,
    title,
    versions,
  ]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== WORKSPACE_STORAGE_KEY || !event.newValue) return;
      try {
        const incomingRevision = (JSON.parse(event.newValue) as { revision?: unknown }).revision;
        if (
          typeof incomingRevision === "number" &&
          incomingRevision > libraryRevisionRef.current
        ) {
          setPersistenceSuspended(true);
          setStatus("Another tab updated this Canvas library. Autosave paused to prevent an overwrite.");
        }
      } catch {
        setPersistenceSuspended(true);
        setStatus("Another tab changed local Canvas data. Autosave paused for safety.");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!autoRun || mode !== "code") return;
    const timer = window.setTimeout(() => {
      setCommittedCode(code);
      setCodeLogs([]);
      setRunId((value) => value + 1);
      setStatus("Preview current · Local");
    }, 520);
    return () => window.clearTimeout(timer);
  }, [autoRun, code, mode]);

  const saveDraftVersion = useCallback(
    (
      sourceDraft: WorkspaceDraft,
      source: WorkspaceVersion["source"] = "manual",
      name?: string,
    ) => {
      const version: WorkspaceVersion = {
        id: makeId(),
        name: name || sourceDraft.title || "Untitled version",
        createdAt: new Date().toISOString(),
        source,
        draft: cloneDraft(sourceDraft),
      };
      setVersions((current) => [version, ...current].slice(0, WORKSPACE_VERSION_LIMIT));
      setStatus(`Checkpoint saved · ${version.name}`);
      return version;
    },
    [],
  );

  const saveVersion = useCallback(
    (source: WorkspaceVersion["source"] = "manual", name?: string) =>
      saveDraftVersion(draft, source, name),
    [draft, saveDraftVersion],
  );

  const runPreview = useCallback(() => {
    if (mode === "code") setCommittedCode(code);
    setCodeLogs([]);
    setRunId((value) => value + 1);
    saveVersion("run", `${title || "Untitled"} · run`);
    setRightTab("preview");
    setMobilePane("preview");
    setStatus("Preview current · Local");
  }, [code, mode, saveVersion, title]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input,textarea,select,[contenteditable='true']");
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        runPreview();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "s") {
        event.preventDefault();
        saveVersion();
      }
      if (!isTyping && event.altKey && /^[1-5]$/.test(event.key)) {
        event.preventDefault();
        setMode(workspaceModes[Number(event.key) - 1]);
      }
      if (!isTyping && event.key === "F6") {
        event.preventDefault();
        setMobilePane((current) =>
          current === "input"
            ? "preview"
            : current === "preview"
              ? "agent"
              : current === "agent"
                ? "versions"
                : "input",
        );
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [runPreview, saveVersion]);

  const updateCurrentText = (value: string) => {
    if (mode === "code") return;
    setTextByMode((current) => ({ ...current, [mode]: value }));
    setStatus("Unsaved changes · Preview updates locally");
  };

  const updateCode = (value: string) => {
    setCode((current) => ({ ...current, [codeFile]: value }));
    setStatus(autoRun ? "Rendering locally…" : "Preview is behind your latest changes");
  };

  const switchMode = (nextMode: WorkspaceMode) => {
    setMode(nextMode);
    setRightTab("preview");
    setMobilePane("input");
    setStatus(`${modeDetails[nextMode].label} workspace active`);
  };

  const snapshotActiveProject = useCallback(
    (projectList: readonly WorkspaceProject[]) => {
      const now = new Date().toISOString();
      return projectList.map((project) =>
        project.id === activeProjectId
          ? {
              ...project,
              mode,
              title,
              textByMode,
              code: { ...code },
              committedCode: { ...committedCode },
              versions: versions.slice(0, WORKSPACE_VERSION_LIMIT),
              updatedAt: now,
            }
          : project,
      );
    },
    [activeProjectId, code, committedCode, mode, textByMode, title, versions],
  );

  const openProject = (projectId: string) => {
    if (projectId === activeProjectId) {
      setProjectLibraryOpen(false);
      return;
    }
    const nextProjects = snapshotActiveProject(projectsRef.current);
    const target = nextProjects.find((project) => project.id === projectId);
    if (!target) return;
    replaceProjects(nextProjects);
    setActiveProjectId(target.id);
    loadProjectIntoEditor(target);
    persistProjects(nextProjects, target.id);
    setProjectLibraryOpen(false);
    setStatus(`Opened ${target.title || "Untitled Canvas project"}`);
  };

  const createProject = () => {
    if (projectsRef.current.length >= WORKSPACE_PROJECT_LIMIT) return;
    const savedProjects = snapshotActiveProject(projectsRef.current);
    const nextProject = createWorkspaceProject({
      ...createInitialProjectContent("idea"),
      title: "Untitled Canvas project",
    });
    const nextProjects = [nextProject, ...savedProjects];
    replaceProjects(nextProjects);
    setActiveProjectId(nextProject.id);
    loadProjectIntoEditor(nextProject);
    persistProjects(nextProjects, nextProject.id);
    setProjectLibraryOpen(false);
    setStatus("New private Canvas project created");
  };

  const duplicateProject = (projectId: string) => {
    if (projectsRef.current.length >= WORKSPACE_PROJECT_LIMIT) return;
    const savedProjects = snapshotActiveProject(projectsRef.current);
    const source = savedProjects.find((project) => project.id === projectId);
    if (!source) return;
    const duplicate = createWorkspaceProject({
      mode: source.mode,
      title: `${source.title || "Untitled Canvas project"} copy`,
      textByMode: source.textByMode,
      code: source.code,
      committedCode: source.committedCode,
      versions: source.versions,
    });
    const nextProjects = [duplicate, ...savedProjects];
    replaceProjects(nextProjects);
    setActiveProjectId(duplicate.id);
    loadProjectIntoEditor(duplicate);
    persistProjects(nextProjects, duplicate.id);
    setProjectLibraryOpen(false);
    setStatus(`Duplicated ${source.title || "Canvas project"}`);
  };

  const deleteProject = (projectId: string) => {
    if (projectsRef.current.length <= 1) return;
    const savedProjects = snapshotActiveProject(projectsRef.current);
    const nextProjects = savedProjects.filter((project) => project.id !== projectId);
    const nextActiveId = projectId === activeProjectId
      ? nextProjects[0].id
      : activeProjectId;
    replaceProjects(nextProjects);
    setActiveProjectId(nextActiveId);
    if (projectId === activeProjectId) loadProjectIntoEditor(nextProjects[0]);
    persistProjects(nextProjects, nextActiveId);
    setStatus("Local project deleted");
  };

  const exportProjectBundle = (projectId: string) => {
    const savedProjects = snapshotActiveProject(projectsRef.current);
    const project = savedProjects.find((value) => value.id === projectId);
    if (!project) return;
    replaceProjects(savedProjects);
    const serialized = serializeWorkspaceProjectBundle(project);
    downloadTextFile(
      serialized,
      "application/json;charset=utf-8",
      `${safeFileName(project.title)}.kxcanvas.json`,
    );
    setStatus("Lossless Canvas project bundle exported");
  };

  const importProjectBundle = async (file: File) => {
    if (file.size > WORKSPACE_BUNDLE_CHARACTER_LIMIT) {
      setStatus("That project bundle exceeds the supported local import size.");
      return;
    }
    try {
      const raw = await file.text();
      const savedProjects = snapshotActiveProject(projectsRef.current);
      const imported = importWorkspaceProjectBundle(
        raw,
        savedProjects.map((project) => project.id),
      );
      const nextProjects = [imported, ...savedProjects];
      replaceProjects(nextProjects);
      setActiveProjectId(imported.id);
      loadProjectIntoEditor(imported);
      persistProjects(nextProjects, imported.id);
      setProjectLibraryOpen(false);
      setStatus(`Imported ${imported.title || "Canvas project"} as a new project`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "That project bundle could not be imported safely.");
    }
  };

  const importCreativeInput = async (file: File) => {
    if (file.size > CREATIVE_INPUT_FILE_LIMIT) {
      setStatus("Creative input files must be smaller than 1 MB.");
      return;
    }
    try {
      const source = await file.text();
      if (!source.trim() || source.includes("\u0000")) {
        throw new Error("Choose a non-empty text-based creative input file.");
      }
      if (sourceLength > 2) {
        saveVersion("manual", `${title || "Untitled"} · before import`);
      }

      const normalizedName = file.name.toLocaleLowerCase();
      const baseName = file.name.replace(/\.[^.]+$/, "").trim();
      if (normalizedName.endsWith(".html") || normalizedName.endsWith(".htm")) {
        const parsed = new DOMParser().parseFromString(source, "text/html");
        const body = parsed.body.cloneNode(true) as HTMLElement;
        body.querySelectorAll("script,style").forEach((node) => node.remove());
        const inlineCss = Array.from(parsed.querySelectorAll("style"))
          .map((node) => node.textContent ?? "")
          .join("\n\n");
        const inlineJavaScript = Array.from(parsed.querySelectorAll("script:not([src])"))
          .map((node) => node.textContent ?? "")
          .join("\n\n");
        const nextCode = {
          html: body.innerHTML.trim() || source,
          css: inlineCss.trim() || code.css,
          javascript: inlineJavaScript.trim() || code.javascript,
        };
        setCode(nextCode);
        setCommittedCode(nextCode);
        setMode("code");
        setCodeFile("html");
        setRunId((value) => value + 1);
      } else if (normalizedName.endsWith(".css")) {
        const nextCode = { ...code, css: source };
        setCode(nextCode);
        setCommittedCode(nextCode);
        setMode("code");
        setCodeFile("css");
        setRunId((value) => value + 1);
      } else if (normalizedName.endsWith(".js") || normalizedName.endsWith(".mjs")) {
        const nextCode = { ...code, javascript: source };
        setCode(nextCode);
        setCommittedCode(nextCode);
        setMode("code");
        setCodeFile("javascript");
        setRunId((value) => value + 1);
      } else {
        const targetMode: Exclude<WorkspaceMode, "code"> =
          /\.(mmd|mindmap|map\.md)$/.test(normalizedName)
            ? "mindmap"
            : normalizedName.includes("prompt")
              ? "prompt"
              : normalizedName.includes("brief")
                ? "brief"
                : mode === "code"
                  ? "idea"
                  : mode;
        setTextByMode((current) => ({ ...current, [targetMode]: source }));
        setMode(targetMode);
      }
      if (!title.trim() || title === initialDraft.title) setTitle(baseName || "Imported concept");
      setRightTab("preview");
      setMobilePane("input");
      setStatus(`${file.name} imported locally · previous source checkpointed`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "That creative input could not be imported.");
    }
  };

  const transformTo = (target: WorkspaceMode) => {
    if (target === mode) return;
    const transformed = transformDraft(draft, target);
    const targetDraft: WorkspaceDraft = {
      mode: target,
      title,
      text: target === "code" ? "" : textByMode[target],
      code,
    };
    const targetHasSource = target === "code"
      ? Boolean(code.html.trim() || code.css.trim() || code.javascript.trim())
      : Boolean(targetDraft.text.trim());
    if (targetHasSource) {
      saveDraftVersion(
        targetDraft,
        "manual",
        `${title || "Untitled"} · ${transformLabels[target]} before transform`,
      );
    }
    if (target === "code") {
      setCode(transformed.code);
      setCommittedCode(transformed.code);
      setRunId((value) => value + 1);
    } else {
      setTextByMode((current) => ({ ...current, [target]: transformed.text }));
    }
    setMode(target);
    setRightTab("preview");
    setStatus(`Created a linked ${transformLabels[target].toLocaleLowerCase()}`);
  };

  const restoreVersion = (version: WorkspaceVersion) => {
    saveVersion("restored", `${title || "Untitled"} · before restore`);
    setMode(version.draft.mode);
    setTitle(version.draft.title);
    if (version.draft.mode === "code") {
      setCode(version.draft.code);
      setCommittedCode(version.draft.code);
      setRunId((value) => value + 1);
    } else {
      setTextByMode((current) => ({
        ...current,
        [version.draft.mode]: version.draft.text,
      }));
    }
    setRightTab("preview");
    setStatus(`Restored ${version.name} as a new branch`);
  };

  const exportCurrent = () => {
    const content = mode === "code" ? buildCodeExport(code) : currentText;
    const type = mode === "code" ? "text/html;charset=utf-8" : "text/markdown;charset=utf-8";
    downloadTextFile(
      content,
      type,
      `${safeFileName(title)}-${mode}.${fileExtension(mode)}`,
    );
    setStatus(`Exported ${transformLabels[mode].toLocaleLowerCase()}`);
  };

  const requestReview = async (quickInstruction?: string) => {
    if (!canReview || reviewRunning) return;
    const submittedDraft = cloneDraft(draft);
    const submittedFingerprint = `${activeProjectId}:${draftFingerprint(submittedDraft)}`;
    const controller = new AbortController();
    controllerRef.current = controller;
    setReviewRunning(true);
    setReviewError("");
    setReviewResponse(null);
    setReviewDraftFingerprint(null);
    setRightTab("agent");
    setMobilePane("agent");
    const objective = quickInstruction || reviewInstruction || "Review this version rigorously and propose the next useful improvement.";

    try {
      const response = await fetch("/api/workspace/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: submittedDraft.mode,
          title: submittedDraft.title,
          text: submittedDraft.text,
          code: submittedDraft.mode === "code" ? submittedDraft.code : EMPTY_CODE,
          objective,
          depth: reviewDepth,
          context: {
            codeLogs: includeLogs ? codeLogs : [],
            versions: includeVersions
              ? versions.slice(0, 3).map((version) => ({
                  name: version.name,
                  mode: version.draft.mode,
                  text: versionContextSource(version),
                }))
              : [],
          },
        }),
      });
      const payload = (await response.json()) as AgentReviewResponse & { error?: string };
      if (!response.ok || !payload.review) {
        throw new Error(payload.error || "The review did not complete.");
      }
      setReviewResponse(payload);
      setReviewDraftFingerprint(submittedFingerprint);
      setStatus(`Review complete · ${payload.source === "openai" ? "Uses AI" : "Local fallback"}`);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setReviewError("Review stopped. Your input is unchanged.");
      } else {
        setReviewError(error instanceof Error ? error.message : "The review did not complete. Your input is unchanged. Try again.");
      }
    } finally {
      setReviewRunning(false);
      controllerRef.current = null;
    }
  };

  const applyAgentVersion = () => {
    const review = reviewResponse?.review;
    if (
      !review ||
      !reviewIsCurrent ||
      (mode === "code" && !review.improvedCode)
    ) return;
    saveVersion("agent", `${title || "Untitled"} · before Agent change`);
    if (mode === "code" && review.improvedCode) {
      const nextCode = { ...review.improvedCode };
      const nextDraft = { ...draft, code: nextCode };
      setCode(nextCode);
      setCommittedCode(nextCode);
      setReviewDraftFingerprint(
        `${activeProjectId}:${draftFingerprint(nextDraft)}`,
      );
      saveDraftVersion(nextDraft, "agent", `${title || "Untitled"} · Agent proposal`);
      setRunId((value) => value + 1);
    } else {
      const nextDraft = { ...draft, text: review.improvedInput };
      setTextByMode((current) => ({ ...current, [mode]: review.improvedInput }));
      setReviewDraftFingerprint(
        `${activeProjectId}:${draftFingerprint(nextDraft)}`,
      );
      saveDraftVersion(nextDraft, "agent", `${title || "Untitled"} · Agent proposal`);
    }
    setRightTab("preview");
    setMobilePane("preview");
    setStatus("Agent proposal applied as a new version");
  };

  const openHandoff = () => handoffRef.current?.showModal();

  const continueToContact = () => {
    const packageValue = {
      generatedAt: new Date().toISOString(),
      current: draft,
      agentReview:
        handoffAgent && reviewIsCurrent ? reviewResponse?.review ?? null : null,
      versions: handoffVersions ? versions.slice(0, 6) : [],
    };
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(packageValue));
    handoffRef.current?.close();
    router.push("/contact?brief=workspace");
  };

  const updatePaneWidth = (next: number) => setPaneWidth(Math.min(68, Math.max(32, next)));
  const handleSeparatorKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const amount = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updatePaneWidth(paneWidth - amount);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      updatePaneWidth(paneWidth + amount);
    }
    if (event.key === "Home") {
      event.preventDefault();
      updatePaneWidth(32);
    }
    if (event.key === "End") {
      event.preventDefault();
      updatePaneWidth(68);
    }
  };

  const handleSeparatorMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !shellRef.current) return;
    const rect = shellRef.current.getBoundingClientRect();
    updatePaneWidth(((event.clientX - rect.left) / rect.width) * 100);
  };

  const shellStyle = { "--workspace-left": `${paneWidth}%` } as CSSProperties;

  return (
    <main className={styles.workspacePage} data-mobile-pane={mobilePane}>
      <section className={styles.intro} aria-labelledby="canvas-title">
        <div>
          <p>Kingxford Canvas · Creative intelligence workspace</p>
          <h1 id="canvas-title">Move from first thought to working proof.</h1>
        </div>
        <p>
          Develop an idea, run front-end code, map a system, test a prompt, or
          shape a production brief—with the input and its result always in view.
        </p>
      </section>

      <div className={styles.workspaceTopbar}>
        <div className={styles.projectIdentity}>
          <span className={styles.liveDot} data-online={isOnline} />
          <div>
            <label htmlFor="workspace-title">Project title</label>
            <input
              id="workspace-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <button
            className={styles.projectLibraryButton}
            type="button"
            onClick={() => setProjectLibraryOpen(true)}
          >
            <FolderKanban aria-hidden="true" />
            Projects <span>{projects.length}</span>
          </button>
        </div>
        <div className={styles.topbarStatus} aria-live="polite">
          <span>{isOnline ? status : "Offline · Local previews still work"}</span>
          <small>Private until you ask the Agent</small>
        </div>
        <div className={styles.topbarActions}>
          <button type="button" onClick={() => creativeInputRef.current?.click()}>
            <FileUp aria-hidden="true" />
            Import input
          </button>
          <input
            ref={creativeInputRef}
            className={styles.hiddenFileInput}
            type="file"
            aria-label="Import a creative input file"
            accept=".txt,.md,.markdown,.html,.htm,.css,.js,.mjs,.mmd,.mindmap,text/plain,text/markdown,text/html,text/css,text/javascript"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importCreativeInput(file);
              event.currentTarget.value = "";
            }}
          />
          <button type="button" onClick={() => saveVersion()}>
            <Save aria-hidden="true" />
            Save version
          </button>
          <button type="button" onClick={exportCurrent}>
            <Download aria-hidden="true" />
            Export
          </button>
          <button className={styles.buildButton} type="button" onClick={openHandoff}>
            <Sparkles aria-hidden="true" />
            Build with Kingxford
          </button>
        </div>
      </div>

      <nav className={styles.mobilePaneTabs} aria-label="Mobile workspace panes">
        {(
          [
            ["input", PanelLeft, "Input"],
            ["preview", PanelRight, "Preview"],
            ["agent", Bot, "Agent"],
            ["versions", History, `Versions ${versions.length}`],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            type="button"
            aria-pressed={mobilePane === value}
            onClick={() => {
              setMobilePane(value);
              if (value === "preview") setRightTab("preview");
              if (value === "agent") setRightTab("agent");
              if (value === "versions") setRightTab("versions");
            }}
            key={value}
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      <div
        ref={shellRef}
        className={styles.workspaceShell}
        style={shellStyle}
      >
        <section className={styles.workbench} aria-label="Creative input workbench">
          <nav className={styles.modeRail} role="tablist" aria-label="Creation modes">
            {workspaceModes.map((value, index) => {
              const Icon = modeIcons[value];
              return (
                <button
                  id={`workspace-mode-${value}`}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  aria-controls="workspace-editor"
                  tabIndex={mode === value ? 0 : -1}
                  title={`${modeDetails[value].label} · Alt+${index + 1}`}
                  onClick={() => switchMode(value)}
                  onKeyDown={(event) =>
                    handleTabArrow(
                      event,
                      workspaceModes,
                      mode,
                      switchMode,
                      (nextMode) => `workspace-mode-${nextMode}`,
                    )
                  }
                  key={value}
                >
                  <Icon aria-hidden="true" />
                  <span>{modeDetails[value].shortLabel}</span>
                </button>
              );
            })}
          </nav>

          <div
            id="workspace-editor"
            className={styles.editorPane}
            role="tabpanel"
            aria-labelledby={`workspace-mode-${mode}`}
          >
            <header className={styles.editorHeading}>
              <div>
                <span>{modeDetails[mode].label} workbench</span>
                <h2>{modeDetails[mode].description}</h2>
              </div>
              <label className={styles.transformControl}>
                <span>Transform into</span>
                <select
                  value={mode}
                  aria-label="Transform current work into another form"
                  onChange={(event) => transformTo(event.target.value as WorkspaceMode)}
                >
                  {workspaceModes.map((value) => (
                    <option value={value} key={value}>{transformLabels[value]}</option>
                  ))}
                </select>
              </label>
            </header>

            {mode === "code" ? (
              <div className={styles.codeEditor}>
                <nav role="tablist" aria-label="Code files">
                  {(
                    [
                      ["html", FileCode2, "HTML"],
                      ["css", Settings2, "CSS"],
                      ["javascript", Braces, "JavaScript"],
                    ] as const
                  ).map(([value, Icon, label]) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={codeFile === value}
                      aria-controls="workspace-code-editor"
                      onClick={() => setCodeFile(value)}
                      key={value}
                    >
                      <Icon aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </nav>
                <label htmlFor="workspace-code-editor" className="sr-only">
                  {codeFile} source
                </label>
                <textarea
                  id="workspace-code-editor"
                  value={code[codeFile]}
                  spellCheck={false}
                  onChange={(event) => updateCode(event.target.value)}
                />
              </div>
            ) : (
              <div className={styles.textEditor}>
                <label htmlFor="workspace-text-editor" className="sr-only">
                  {modeDetails[mode].label} source
                </label>
                <textarea
                  id="workspace-text-editor"
                  value={currentText}
                  placeholder={modeDetails[mode].placeholder}
                  spellCheck
                  onChange={(event) => updateCurrentText(event.target.value)}
                />
              </div>
            )}

            <footer className={styles.editorFooter}>
              <div>
                <span>{sourceLength.toLocaleString()} characters</span>
                <span>Local source</span>
              </div>
              {mode === "code" && (
                <label className={styles.autoRun}>
                  <input
                    type="checkbox"
                    checked={autoRun}
                    onChange={(event) => setAutoRun(event.target.checked)}
                  />
                  Auto-run
                </label>
              )}
              <button type="button" onClick={runPreview}>
                <Play aria-hidden="true" />
                Run <kbd>⌘↵</kbd>
              </button>
            </footer>
          </div>
        </section>

        <div
          className={styles.paneSeparator}
          role="separator"
          aria-label="Resize workbench and result panes"
          aria-orientation="vertical"
          aria-valuemin={32}
          aria-valuemax={68}
          aria-valuenow={Math.round(paneWidth)}
          tabIndex={0}
          onKeyDown={handleSeparatorKey}
          onPointerDown={(event) => {
            draggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={handleSeparatorMove}
          onPointerUp={(event) => {
            draggingRef.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onDoubleClick={() => updatePaneWidth(51)}
        >
          <span />
          <small>{Math.round(paneWidth)} / {100 - Math.round(paneWidth)}</small>
        </div>

        <section className={styles.resultPane} aria-label="Live result and agent review">
          <nav className={styles.resultTabs} role="tablist" aria-label="Result views">
            {(
              [
                ["preview", PanelRight, "Live preview"],
                ["agent", Bot, "Agent review"],
                ["versions", History, `Versions ${versions.length}`],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                id={`workspace-result-tab-${value}`}
                type="button"
                role="tab"
                aria-selected={rightTab === value}
                aria-controls={`workspace-${value}-panel`}
                tabIndex={rightTab === value ? 0 : -1}
                onClick={() => setRightTab(value)}
                onKeyDown={(event) =>
                  handleTabArrow(
                    event,
                    ["preview", "agent", "versions"] as const,
                    rightTab,
                    setRightTab,
                    (nextTab) => `workspace-result-tab-${nextTab}`,
                  )
                }
                key={value}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
            <span className={styles.localBadge} title="Rendered in this browser. Nothing was sent to AI.">
              <span /> Local
            </span>
          </nav>

          <div
            id="workspace-preview-panel"
            className={styles.resultView}
            role="tabpanel"
            aria-labelledby="workspace-result-tab-preview"
            hidden={rightTab !== "preview"}
          >
            <WorkspacePreview
              draft={draft}
              committedCode={committedCode}
              runId={runId}
              onCodeLogs={setCodeLogs}
            />
          </div>
          <div
            id="workspace-agent-panel"
            className={styles.resultView}
            role="tabpanel"
            aria-labelledby="workspace-result-tab-agent"
            hidden={rightTab !== "agent"}
          >
            <AgentReviewPanel
              response={reviewResponse}
              isRunning={reviewRunning}
              error={reviewError}
              instruction={reviewInstruction}
              depth={reviewDepth}
              canReview={canReview && isOnline}
              reviewIsCurrent={reviewIsCurrent}
              includeLogs={includeLogs}
              includeVersions={includeVersions}
              onInstruction={setReviewInstruction}
              onDepth={setReviewDepth}
              onIncludeLogs={setIncludeLogs}
              onIncludeVersions={setIncludeVersions}
              onReview={requestReview}
              onStop={() => controllerRef.current?.abort()}
              onApply={applyAgentVersion}
            />
          </div>
          <div
            id="workspace-versions-panel"
            className={styles.resultView}
            role="tabpanel"
            aria-labelledby="workspace-result-tab-versions"
            hidden={rightTab !== "versions"}
          >
            <VersionPanel
              versions={versions}
              currentDraft={draft}
              onSave={() => saveVersion()}
              onRestore={restoreVersion}
              onClear={() => {
                setVersions([]);
                setStatus("Local version history cleared");
              }}
            />
          </div>
        </section>
      </div>

      <div className={styles.mobileActionBar}>
        <button type="button" onClick={runPreview}>
          <Play aria-hidden="true" />
          Run
        </button>
        <button
          type="button"
          disabled={!canReview || reviewRunning || !isOnline}
          onClick={() => requestReview()}
        >
          <Sparkles aria-hidden="true" />
          Review
        </button>
      </div>

      <section className={styles.handoffStrip}>
        <div>
          <span>From tested idea to production</span>
          <h2>You have the proof. Kingxford can build the system.</h2>
        </div>
        <p>
          A validated starting point can reduce discovery work. We will review
          the actual scope before providing a tailored plan and estimate.
        </p>
        <button type="button" onClick={openHandoff}>
          Prepare a build request
          <ArrowRight aria-hidden="true" />
        </button>
      </section>

      <dialog
        ref={handoffRef}
        className={styles.handoffDialog}
        aria-labelledby="handoff-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
      >
        <div className={styles.handoffCard}>
          <header>
            <div>
              <span>Build with Kingxford</span>
              <h2 id="handoff-title">Take this from tested idea to production.</h2>
            </div>
            <button type="button" aria-label="Close build request" onClick={() => handoffRef.current?.close()}>
              <X aria-hidden="true" />
            </button>
          </header>
          <p>
            Choose the context to carry into your private problem brief. Nothing
            is submitted until you deliberately contact Kingxford.
          </p>
          <div className={styles.handoffOptions}>
            <label><input type="checkbox" checked readOnly /> Current version</label>
            <label>
              <input
                type="checkbox"
                checked={handoffAgent && reviewIsCurrent}
                disabled={!reviewIsCurrent}
                onChange={(event) => setHandoffAgent(event.target.checked)}
              />
              Agent review {reviewResponse && !reviewIsCurrent ? "(out of date)" : ""}
            </label>
            <label>
              <input
                type="checkbox"
                checked={handoffVersions}
                disabled={!versions.length}
                onChange={(event) => setHandoffVersions(event.target.checked)}
              />
              Version history
            </label>
          </div>
          <div className={styles.handoffSummary}>
            <span>{transformLabels[mode]}</span>
            <strong>{title || "Untitled concept"}</strong>
            <small>{sourceLength.toLocaleString()} source characters · {versions.length} saved versions</small>
          </div>
          <button className={styles.handoffPrimary} type="button" onClick={continueToContact}>
            Request a scoped build plan
            <ArrowRight aria-hidden="true" />
          </button>
          {entrepreneurshipUrl ? (
            <a className={styles.entrepreneurshipLink} href={entrepreneurshipUrl}>
              Continue in AI-driven Entrepreneurship Platform
              <ArrowRight aria-hidden="true" />
            </a>
          ) : (
            <button className={styles.entrepreneurshipLink} type="button" disabled title="This destination is not available yet. Your workspace can be transferred when it launches.">
              Continue in AI-driven Entrepreneurship Platform
              <span>Coming later</span>
            </button>
          )}
        </div>
      </dialog>

      <ProjectLibraryDialog
        open={projectLibraryOpen}
        projects={projects}
        activeProjectId={activeProjectId}
        projectLimit={WORKSPACE_PROJECT_LIMIT}
        onClose={() => setProjectLibraryOpen(false)}
        onCreate={createProject}
        onOpen={openProject}
        onDuplicate={duplicateProject}
        onExport={exportProjectBundle}
        onDelete={deleteProject}
        onImport={(file) => void importProjectBundle(file)}
      />
    </main>
  );
}
