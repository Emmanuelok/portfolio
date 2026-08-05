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
  Layers3,
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
  intelligenceCapabilities,
  intelligenceRunRequestSchema,
  intelligenceRunResponseSchema,
  type IntelligenceRunRequest,
  type IntelligenceRunResponse,
} from "@/lib/intelligence/contracts";
import {
  getPlatformPhase,
  getPrimaryPhaseForMode,
  PLATFORM_AGENTS,
  PLATFORM_LIFECYCLE,
} from "@/lib/platform/registry";
import {
  consumePlatformSeed,
  readPlatformSeed,
  type PlatformSeedV1,
} from "@/lib/platform/seed";
import {
  createEmptyPlatformSidecar,
  createPlatformProjectIntelligence,
  dispatchPlatformChange,
  loadPlatformSidecar,
  PLATFORM_CHANGE_EVENT,
  PLATFORM_STORAGE_KEY,
  removePlatformProject,
  savePlatformSidecar,
  upsertPlatformProject,
} from "@/lib/platform/storage";
import type {
  PlatformAgentRole,
  PlatformMapViewState,
  PlatformPhase,
  PlatformProjectIntelligence,
  PlatformSidecarV1,
} from "@/lib/platform/types";
import {
  importPlatformProjectBundle,
  PLATFORM_PROJECT_BUNDLE_CHARACTER_LIMIT,
  serializePlatformProjectBundle,
} from "@/lib/platform/project-bundle";
import {
  initialDraft,
  modeDetails,
  starterText,
  transformLabels,
} from "@/lib/workspace/presets";
import {
  createWorkspaceLibrary,
  createWorkspaceProject,
  loadWorkspaceLibrary,
  saveWorkspaceLibrary,
  WORKSPACE_PROJECT_LIMIT,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_VERSION_LIMIT,
} from "@/lib/workspace/storage";
import type {
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

import { ProjectIntelligencePanel } from "./ProjectIntelligencePanel";
import { ProjectLibraryDialog } from "./ProjectLibraryDialog";
import { WorkspacePreview } from "./WorkspacePreview";
import styles from "./CreativeWorkspace.module.css";

type RightTab = "preview" | "intelligence" | "agent" | "versions";
type MobilePane = "input" | "preview" | "intelligence" | "agent" | "versions";
type CodeFileKey = keyof CodeFiles;

type CreativeWorkspaceProps = Readonly<{
  entrepreneurshipUrl: string | null;
  initialMode: WorkspaceMode | null;
  initialPhase?: PlatformPhase | null;
  startFromSeed?: boolean;
  embedded?: boolean;
}>;

const HANDOFF_KEY = "kingxford:canvas-handoff:v1";
const HANDOFF_CHARACTER_LIMIT = 1_000_000;
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

function createSeededProjectContent(seed: PlatformSeedV1): WorkspaceProjectContent {
  const base = createInitialProjectContent(seed.mode);
  return {
    ...base,
    title: seed.title || "Untitled Kingxford project",
    textByMode: seed.mode === "code"
      ? base.textByMode
      : { ...base.textByMode, [seed.mode]: seed.input },
    code: seed.mode === "code"
      ? { html: seed.input, css: "", javascript: "" }
      : base.code,
    committedCode: seed.mode === "code"
      ? { html: seed.input, css: "", javascript: "" }
      : base.committedCode,
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
  roleLabel,
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
  response: IntelligenceRunResponse | null;
  roleLabel: string;
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
            <span>Kingxford Intelligence · {roleLabel}</span>
            <h2 id="agent-panel-heading">Governed specialist review</h2>
          </div>
        </div>
        <div className={styles.agentProtocol}>
          <span>
            {response?.source === "openai"
              ? formatAgentModel(response.model)
              : "GPT-5.6 Sol target"}
          </span>
          <small>Versioned evaluation protocol</small>
        </div>
      </header>

      <div className={styles.agentTruth}>
        <Bot aria-hidden="true" />
        <p>
          Configuration and safety gates run daily. Capability changes are
          reviewed, versioned, and rollbackable; the Agent does not rewrite
          itself or learn from your private work.
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

          <section className={styles.conductorPlan}>
            <header>
              <div>
                <span>Conductor plan</span>
                <h3>{response.orchestration.plan.phaseObjective}</h3>
              </div>
              <small>{response.status}</small>
            </header>
            <p>{response.orchestration.plan.summary}</p>
            <ol>
              {response.orchestration.plan.sequence.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <div>
              {response.orchestration.passes.map((pass) => (
                <article key={pass.id} data-status={pass.status}>
                  <span>{pass.role}</span>
                  <strong>{pass.status}</strong>
                  <small>{formatAgentModel(pass.model)} · {pass.source}</small>
                </article>
              ))}
            </div>
          </section>

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

          <details className={styles.agentProvenance}>
            <summary>Inspect run provenance</summary>
            <div>
              <p>{response.artifacts.length} versioned artifacts · {response.provenance.providerCalls.length} provider calls</p>
              <code>Final artifact: {response.provenance.finalArtifactId}</code>
              <code>Input digest: {response.inputDigest}</code>
              <code>Protocol: {response.protocolVersion}</code>
            </div>
          </details>
        </div>
      )}

      <div className={styles.agentComposer}>
        <label htmlFor="agent-instruction">Ask the Agent to examine this version</label>
        <textarea
          id="agent-instruction"
          value={instruction}
          rows={3}
          maxLength={600}
          placeholder="Challenge the assumptions and make the next test more rigorous…"
          onChange={(event) => onInstruction(event.target.value)}
        />
        <div className={styles.agentContext}>
          <div>
            <span>Choose what the Agent can see</span>
            <label><input type="checkbox" checked readOnly /> Current input</label>
            <label><input type="checkbox" checked readOnly /> Project intelligence ledger</label>
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
              Deep · Max
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
  initialPhase = null,
  startFromSeed = false,
  embedded = false,
}: CreativeWorkspaceProps) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const handoffRef = useRef<HTMLDialogElement>(null);
  const creativeInputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const draggingRef = useRef(false);
  const projectsRef = useRef<readonly WorkspaceProject[]>([]);
  const libraryRevisionRef = useRef(0);
  const platformSidecarRef = useRef<PlatformSidecarV1>(createEmptyPlatformSidecar());
  const intelligenceIssueRef = useRef("");

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
  const [reviewResponse, setReviewResponse] = useState<IntelligenceRunResponse | null>(null);
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
  const [handoffError, setHandoffError] = useState("");
  const [projects, setProjects] = useState<readonly WorkspaceProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState("");
  const [projectLibraryOpen, setProjectLibraryOpen] = useState(false);
  const [persistenceSuspended, setPersistenceSuspended] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhaseState] = useState<PlatformPhase>(
    initialPhase ?? getPrimaryPhaseForMode(initialMode ?? initialDraft.mode).id,
  );
  const [agentRole, setAgentRole] = useState<PlatformAgentRole>("conductor");
  const [mapView, setMapView] = useState<PlatformMapViewState | null>(null);
  const [activeIntelligence, setActiveIntelligence] = useState<PlatformProjectIntelligence | null>(null);
  const [intelligenceStorageError, setIntelligenceStorageError] = useState("");

  const currentText = mode === "code" ? "" : textByMode[mode];
  const draft = useMemo<WorkspaceDraft>(
    () => ({ mode, title, text: currentText, code }),
    [code, currentText, mode, title],
  );
  const currentDraftFingerprint = useMemo(() => draftFingerprint(draft), [draft]);
  const reviewIsCurrent = Boolean(
    reviewResponse &&
      reviewDraftFingerprint === `${activeProjectId}:${phase}:${agentRole}:${currentDraftFingerprint}`,
  );
  const canReview = mode === "code"
    ? Boolean(code.html.trim() || code.css.trim() || code.javascript.trim())
    : currentText.trim().length > 2;
  const sourceLength = mode === "code"
    ? code.html.length + code.css.length + code.javascript.length
    : currentText.length;
  const activePhase = getPlatformPhase(phase) ?? PLATFORM_LIFECYCLE[0];
  const activeAgents = PLATFORM_AGENTS.filter((agent) =>
    activePhase.agents.includes(agent.id),
  );

  const replaceProjects = useCallback((nextProjects: readonly WorkspaceProject[]) => {
    projectsRef.current = nextProjects;
    setProjects(nextProjects);
  }, []);

  const saveProjectIntelligence = useCallback((
    projectId: string,
    update: (current: PlatformProjectIntelligence) => PlatformProjectIntelligence,
  ) => {
    const latest = loadPlatformSidecar(window.localStorage);
    if (latest.status === "error") {
      intelligenceIssueRef.current = latest.error.message;
      setIntelligenceStorageError(latest.error.message);
      setStatus(`${latest.error.message} The existing record was not overwritten.`);
      return false;
    }
    platformSidecarRef.current = latest.sidecar;
    const current = latest.sidecar.projects[projectId] ??
      createPlatformProjectIntelligence(projectId, { phase: initialPhase ?? "discover" });
    let nextSidecar: PlatformSidecarV1;
    try {
      nextSidecar = upsertPlatformProject(
        platformSidecarRef.current,
        update(current),
      );
    } catch {
      const message = "Project intelligence could not be validated.";
      intelligenceIssueRef.current = message;
      setIntelligenceStorageError(message);
      setStatus(`${message} Editable work remains safe.`);
      return false;
    }
    const saved = savePlatformSidecar(window.localStorage, nextSidecar);
    if (!saved.ok) {
      intelligenceIssueRef.current = saved.error.message;
      setIntelligenceStorageError(saved.error.message);
      setStatus(`${saved.error.message} Editable work remains safe.`);
      return false;
    }
    platformSidecarRef.current = nextSidecar;
    setActiveIntelligence(nextSidecar.projects[projectId]);
    intelligenceIssueRef.current = "";
    setIntelligenceStorageError("");
    dispatchPlatformChange({
      revision: nextSidecar.revision,
      projectId,
      reason: "saved",
    });
    return true;
  }, [initialPhase]);

  const loadProjectIntoEditor = useCallback(
    (
      project: WorkspaceProject,
      requestedMode?: WorkspaceMode | null,
      requestedPhase?: PlatformPhase | null,
    ) => {
      controllerRef.current?.abort();
      const nextMode = requestedMode ?? project.mode;
      const intelligence = platformSidecarRef.current.projects[project.id];
      setMode(nextMode);
      setPhaseState(
        requestedPhase ?? intelligence?.phase ?? getPrimaryPhaseForMode(nextMode).id,
      );
      setMapView(intelligence?.mapView ?? null);
      setActiveIntelligence(
        intelligence ?? createPlatformProjectIntelligence(project.id, {
          phase: requestedPhase ?? getPrimaryPhaseForMode(nextMode).id,
        }),
      );
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

  const selectPhase = (nextPhase: PlatformPhase) => {
    const definition = getPlatformPhase(nextPhase);
    const firstSpecialist = definition?.agents.find((role) => role !== "conductor");
    if (!activeProjectId) {
      setStatus("Wait for the local project to finish loading before changing phase.");
      return;
    }
    const saved = saveProjectIntelligence(activeProjectId, (current) => ({
      ...current,
      phase: nextPhase,
      updatedAt: new Date().toISOString(),
    }));
    if (!saved) return;
    setPhaseState(nextPhase);
    setAgentRole(firstSpecialist ?? "conductor");
    setStatus(`${definition?.label ?? "Project"} phase active · Context preserved`);
  };

  const commitMapView = useCallback((nextView: PlatformMapViewState) => {
    setMapView(nextView);
    if (!activeProjectId) return;
    saveProjectIntelligence(activeProjectId, (current) => ({
      ...current,
      mapView: nextView,
      updatedAt: new Date().toISOString(),
    }));
  }, [activeProjectId, saveProjectIntelligence]);

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

  const persistSidecar = useCallback((
    nextSidecar: PlatformSidecarV1,
    projectId: string | null,
    reason: "saved" | "removed" | "recovered" = "saved",
  ) => {
    const loaded = loadPlatformSidecar(window.localStorage);
    if (loaded.status === "error") {
      intelligenceIssueRef.current = loaded.error.message;
      setIntelligenceStorageError(loaded.error.message);
      setStatus(`${loaded.error.message} The existing intelligence record was not overwritten.`);
      return false;
    }
    if (loaded.sidecar.revision !== platformSidecarRef.current.revision) {
      platformSidecarRef.current = loaded.sidecar;
      const message = "Project intelligence changed in another tab. Review it and retry this operation.";
      intelligenceIssueRef.current = message;
      setIntelligenceStorageError(message);
      setStatus(message);
      return false;
    }
    const saved = savePlatformSidecar(window.localStorage, nextSidecar);
    if (!saved.ok) {
      intelligenceIssueRef.current = saved.error.message;
      setIntelligenceStorageError(saved.error.message);
      setStatus(`${saved.error.message} Editable source remains safe.`);
      return false;
    }
    platformSidecarRef.current = nextSidecar;
    intelligenceIssueRef.current = "";
    setIntelligenceStorageError("");
    dispatchPlatformChange({ revision: nextSidecar.revision, projectId, reason });
    return true;
  }, []);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    const hydrateFrame = window.requestAnimationFrame(() => {
      setIsOnline(navigator.onLine);
      const loadedIntelligence = loadPlatformSidecar(window.localStorage);
      const intelligenceAvailable = loadedIntelligence.status !== "error";
      if (loadedIntelligence.status === "ready" || loadedIntelligence.status === "empty") {
        platformSidecarRef.current = loadedIntelligence.sidecar;
        intelligenceIssueRef.current = "";
        setIntelligenceStorageError("");
      } else {
        platformSidecarRef.current = createEmptyPlatformSidecar();
        intelligenceIssueRef.current = loadedIntelligence.error.message;
        setIntelligenceStorageError(loadedIntelligence.error.message);
        setStatus(`${loadedIntelligence.error.message} Editable Canvas work remains available.`);
      }

      const seedResult = startFromSeed
        ? readPlatformSeed(window.sessionStorage)
        : ({ status: "empty" } as const);
      const seed = seedResult.status === "ready" ? seedResult.seed : null;

      const openSeededProject = (
        existingProjects: readonly WorkspaceProject[],
        currentRevision: number,
      ) => {
        if (!seed) return false;
        if (existingProjects.length >= WORKSPACE_PROJECT_LIMIT) {
          setStatus(`Your ${WORKSPACE_PROJECT_LIMIT} project limit is full. Export or remove a project before starting this idea.`);
          return false;
        }
        const project = createWorkspaceProject(createSeededProjectContent(seed));
        const nextProjects = [project, ...existingProjects];
        const library: WorkspaceLibraryV2 = {
          schemaVersion: 2,
          revision: currentRevision + 1,
          activeProjectId: project.id,
          projects: nextProjects,
        };
        const saved = saveWorkspaceLibrary(window.localStorage, library);
        if (!saved.ok) {
          setStatus(`${saved.error.message} The project start remains available in this tab.`);
          return false;
        }

        replaceProjects(nextProjects);
        libraryRevisionRef.current = library.revision;
        setActiveProjectId(project.id);
        const intelligence = createPlatformProjectIntelligence(project.id, {
          objective: seed.input,
          phase: seed.phase,
        });
        let intelligenceSaved = false;
        try {
          if (!intelligenceAvailable) throw new Error("Project intelligence storage is not readable.");
          const nextSidecar = upsertPlatformProject(
            platformSidecarRef.current,
            intelligence,
          );
          const sidecarSaved = savePlatformSidecar(window.localStorage, nextSidecar);
          if (sidecarSaved.ok) {
            intelligenceSaved = true;
            platformSidecarRef.current = nextSidecar;
            intelligenceIssueRef.current = "";
            setIntelligenceStorageError("");
            dispatchPlatformChange({
              revision: nextSidecar.revision,
              projectId: project.id,
              reason: "saved",
            });
          } else {
            intelligenceIssueRef.current = sidecarSaved.error.message;
            setIntelligenceStorageError(sidecarSaved.error.message);
          }
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : "Project intelligence could not be persisted.";
          if (!intelligenceIssueRef.current) intelligenceIssueRef.current = message;
          setIntelligenceStorageError(intelligenceIssueRef.current);
        }
        consumePlatformSeed(window.sessionStorage);
        loadProjectIntoEditor(project, seed.mode, seed.phase);
        setStatus(intelligenceSaved
          ? "New project created from your original idea · Discovery context preserved"
          : `Editable project created. Intelligence warning: ${intelligenceIssueRef.current}`);
        return true;
      };

      const loaded = loadWorkspaceLibrary(window.localStorage);
      if (loaded.status === "ready") {
        if (openSeededProject(loaded.library.projects, loaded.library.revision)) {
          setHydrated(true);
          return;
        }
        const active = loaded.library.projects.find(
          (project) => project.id === loaded.library.activeProjectId,
        ) ?? loaded.library.projects[0];
        if (intelligenceAvailable) {
          const projectIds = new Set(loaded.library.projects.map((project) => project.id));
          let reconciled = platformSidecarRef.current;
          for (const projectId of Object.keys(reconciled.projects)) {
            if (!projectIds.has(projectId)) reconciled = removePlatformProject(reconciled, projectId);
          }
          if (reconciled.revision !== platformSidecarRef.current.revision) {
            const savedReconciled = savePlatformSidecar(window.localStorage, reconciled);
            if (savedReconciled.ok) {
              platformSidecarRef.current = reconciled;
              dispatchPlatformChange({ revision: reconciled.revision, projectId: null, reason: "recovered" });
            }
          }
        }
        replaceProjects(loaded.library.projects);
        libraryRevisionRef.current = loaded.library.revision;
        setActiveProjectId(active.id);
        loadProjectIntoEditor(active, initialMode, initialPhase);
        if (loaded.needsPersistence) {
          const migrated = saveWorkspaceLibrary(window.localStorage, loaded.library);
          setStatus(
            migrated.ok
              ? "Previous Canvas work migrated into your project library"
              : `${migrated.error.message} Current edits remain open.`,
          );
        }
      } else if (loaded.status === "empty") {
        if (openSeededProject([], 0)) {
          setHydrated(true);
          return;
        }
        const project = createWorkspaceProject(
          createInitialProjectContent(initialMode ?? initialDraft.mode),
        );
        const library = createWorkspaceLibrary(project);
        replaceProjects(library.projects);
        libraryRevisionRef.current = library.revision;
        setActiveProjectId(project.id);
        loadProjectIntoEditor(project, initialMode, initialPhase);
        const saved = saveWorkspaceLibrary(window.localStorage, library);
        if (!saved.ok) setStatus(`${saved.error.message} Current edits remain open.`);
      } else {
        const project = createWorkspaceProject(
          createInitialProjectContent(initialMode ?? initialDraft.mode),
        );
        replaceProjects([project]);
        setActiveProjectId(project.id);
        loadProjectIntoEditor(project, initialMode, initialPhase);
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
  }, [initialMode, initialPhase, loadProjectIntoEditor, replaceProjects, startFromSeed]);

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
        setStatus(intelligenceIssueRef.current
          ? `Editable source saved. Intelligence warning: ${intelligenceIssueRef.current}`
          : "Saved on this device");
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
    if (!activeProjectId) return;
    const reloadIntelligence = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== PLATFORM_STORAGE_KEY) return;
      const loaded = loadPlatformSidecar(window.localStorage);
      if (loaded.status === "error") {
        setIntelligenceStorageError(loaded.error.message);
        return;
      }
      platformSidecarRef.current = loaded.sidecar;
      setIntelligenceStorageError("");
      const current = loaded.sidecar.projects[activeProjectId] ??
        createPlatformProjectIntelligence(activeProjectId, { phase });
      setActiveIntelligence(current);
      setMapView(current.mapView);
    };
    window.addEventListener("storage", reloadIntelligence);
    window.addEventListener(PLATFORM_CHANGE_EVENT, reloadIntelligence);
    return () => {
      window.removeEventListener("storage", reloadIntelligence);
      window.removeEventListener(PLATFORM_CHANGE_EVENT, reloadIntelligence);
    };
  }, [activeProjectId, phase]);

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

  const selectMobilePane = useCallback((nextPane: MobilePane) => {
    setMobilePane(nextPane);
    if (nextPane !== "input") setRightTab(nextPane);
  }, []);

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
        const panes: readonly MobilePane[] = ["input", "preview", "intelligence", "agent", "versions"];
        const currentIndex = panes.indexOf(mobilePane);
        selectMobilePane(panes[(currentIndex + 1) % panes.length]);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [mobilePane, runPreview, saveVersion, selectMobilePane]);

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
    if (!persistProjects(nextProjects, target.id)) return;
    replaceProjects(nextProjects);
    setActiveProjectId(target.id);
    loadProjectIntoEditor(target);
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
    if (!persistProjects(nextProjects, nextProject.id)) return;
    let intelligenceSaved = false;
    try {
      const nextSidecar = upsertPlatformProject(
        platformSidecarRef.current,
        createPlatformProjectIntelligence(nextProject.id, { phase: "discover" }),
      );
      intelligenceSaved = persistSidecar(nextSidecar, nextProject.id);
    } catch {
      intelligenceSaved = false;
    }
    replaceProjects(nextProjects);
    setActiveProjectId(nextProject.id);
    loadProjectIntoEditor(nextProject);
    setProjectLibraryOpen(false);
    setStatus(intelligenceSaved
      ? "New private intelligence project created"
      : "Project created; its intelligence ledger is temporarily unavailable");
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
    if (!persistProjects(nextProjects, duplicate.id)) return;
    let intelligenceSaved = false;
    const sourceIntelligence = platformSidecarRef.current.projects[source.id] ??
      createPlatformProjectIntelligence(source.id, { phase: getPrimaryPhaseForMode(source.mode).id });
    try {
      const duplicateIntelligence: PlatformProjectIntelligence = {
        ...sourceIntelligence,
        projectId: duplicate.id,
        evidence: sourceIntelligence.evidence.map((item) => ({ ...item })),
        decisions: sourceIntelligence.decisions.map((item) => ({
          ...item,
          relatedArtifactIds: [...item.relatedArtifactIds],
        })),
        artifactRelationships: sourceIntelligence.artifactRelationships.map((item) => ({ ...item })),
        agentRuns: sourceIntelligence.agentRuns.map((item) => ({
          ...item,
          artifactIds: [...item.artifactIds],
        })),
        mapView: sourceIntelligence.mapView ? {
          zoom: sourceIntelligence.mapView.zoom,
          pan: { ...sourceIntelligence.mapView.pan },
          nodeOffsets: Object.fromEntries(
            Object.entries(sourceIntelligence.mapView.nodeOffsets).map(([id, point]) => [id, { ...point }]),
          ),
        } : null,
        updatedAt: new Date().toISOString(),
      };
      intelligenceSaved = persistSidecar(
        upsertPlatformProject(platformSidecarRef.current, duplicateIntelligence),
        duplicate.id,
      );
    } catch {
      intelligenceSaved = false;
    }
    replaceProjects(nextProjects);
    setActiveProjectId(duplicate.id);
    loadProjectIntoEditor(duplicate);
    setProjectLibraryOpen(false);
    setStatus(intelligenceSaved
      ? `Duplicated ${source.title || "project"} with its complete intelligence ledger`
      : `Duplicated ${source.title || "project"}; its intelligence ledger could not be copied`);
  };

  const deleteProject = (projectId: string) => {
    if (projectsRef.current.length <= 1) return;
    const savedProjects = snapshotActiveProject(projectsRef.current);
    const nextProjects = savedProjects.filter((project) => project.id !== projectId);
    const nextActiveId = projectId === activeProjectId
      ? nextProjects[0].id
      : activeProjectId;
    if (!persistProjects(nextProjects, nextActiveId)) return;
    let intelligenceRemoved = false;
    try {
      intelligenceRemoved = persistSidecar(
        removePlatformProject(platformSidecarRef.current, projectId),
        projectId,
        "removed",
      );
    } catch {
      intelligenceRemoved = false;
    }
    replaceProjects(nextProjects);
    setActiveProjectId(nextActiveId);
    if (projectId === activeProjectId) loadProjectIntoEditor(nextProjects[0]);
    setStatus(intelligenceRemoved
      ? "Local project and intelligence ledger deleted"
      : "Editable project deleted; intelligence cleanup is pending");
  };

  const exportProjectBundle = (projectId: string) => {
    const savedProjects = snapshotActiveProject(projectsRef.current);
    const project = savedProjects.find((value) => value.id === projectId);
    if (!project) return;
    replaceProjects(savedProjects);
    const intelligence = platformSidecarRef.current.projects[project.id] ??
      createPlatformProjectIntelligence(project.id, { phase: getPrimaryPhaseForMode(project.mode).id });
    const serialized = serializePlatformProjectBundle(project, intelligence);
    downloadTextFile(
      serialized,
      "application/json;charset=utf-8",
      `${safeFileName(project.title)}.kxproject.json`,
    );
    setStatus("Complete project source and intelligence bundle exported");
  };

  const importProjectBundle = async (file: File) => {
    if (file.size > PLATFORM_PROJECT_BUNDLE_CHARACTER_LIMIT) {
      setStatus("That project bundle exceeds the supported local import size.");
      return;
    }
    try {
      const raw = await file.text();
      const savedProjects = snapshotActiveProject(projectsRef.current);
      if (savedProjects.length >= WORKSPACE_PROJECT_LIMIT) {
        throw new Error(`Your ${WORKSPACE_PROJECT_LIMIT} project limit is full.`);
      }
      const importedBundle = importPlatformProjectBundle(
        raw,
        savedProjects.map((project) => project.id),
      );
      const imported = importedBundle.project;
      const nextProjects = [imported, ...savedProjects];
      if (!persistProjects(nextProjects, imported.id)) return;
      let intelligenceSaved = false;
      try {
        intelligenceSaved = persistSidecar(
          upsertPlatformProject(platformSidecarRef.current, importedBundle.intelligence),
          imported.id,
        );
      } catch {
        intelligenceSaved = false;
      }
      replaceProjects(nextProjects);
      setActiveProjectId(imported.id);
      loadProjectIntoEditor(imported);
      setProjectLibraryOpen(false);
      setStatus(intelligenceSaved
        ? `Imported ${imported.title || "project"} with complete intelligence`
        : `Imported ${imported.title || "project"}; intelligence restoration is pending`);
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
    const submittedFingerprint = `${activeProjectId}:${phase}:${agentRole}:${draftFingerprint(submittedDraft)}`;
    const controller = new AbortController();
    controllerRef.current = controller;
    setReviewRunning(true);
    setReviewError("");
    setReviewResponse(null);
    setReviewDraftFingerprint(null);
    setRightTab("agent");
    setMobilePane("agent");
    const objective = (quickInstruction || reviewInstruction || "Review this version rigorously and propose the next useful improvement.").slice(0, 600);
    const projectIntelligence = activeIntelligence ??
      createPlatformProjectIntelligence(activeProjectId, { phase });

    try {
      const requestCandidate: IntelligenceRunRequest = {
        mode: submittedDraft.mode,
        title: submittedDraft.title.slice(0, 120),
        text: submittedDraft.text.slice(0, 22_000),
        code: submittedDraft.mode === "code" ? {
          html: submittedDraft.code.html.slice(0, 16_000),
          css: submittedDraft.code.css.slice(0, 16_000),
          javascript: submittedDraft.code.javascript.slice(0, 16_000),
        } : EMPTY_CODE,
        objective,
        depth: reviewDepth,
        projectContext: {
          projectId: activeProjectId,
          objective: projectIntelligence.objective.slice(0, 600),
          phase,
          evidence: projectIntelligence.evidence.slice(-24).map((item) => ({
            ...item,
            title: item.title.slice(0, 180),
            source: item.source.slice(0, 2_000),
            claim: item.claim.slice(0, 2_000),
          })),
          decisions: projectIntelligence.decisions.slice(-24).map((item) => ({
            ...item,
            title: item.title.slice(0, 180),
            decision: item.decision.slice(0, 2_000),
            rationale: item.rationale.slice(0, 2_000),
            relatedArtifactIds: item.relatedArtifactIds.slice(0, 16),
          })),
          acceptedRuns: projectIntelligence.agentRuns.slice(-24).map((item) => ({
            ...item,
            summary: item.summary.slice(0, 1_600),
            artifactIds: item.artifactIds.slice(0, 16),
          })),
          artifacts: [
            {
              id: `source:${activeProjectId}`,
              title: (submittedDraft.title || "Current workspace source").slice(0, 180),
              kind: "workspace-source" as const,
              summary: (submittedDraft.mode === "code"
                ? "Current HTML, CSS, and JavaScript working source."
                : submittedDraft.text).slice(0, 1_600),
              createdAt: new Date().toISOString(),
            },
            ...versions.slice(0, 6).map((version) => ({
              id: version.id,
              title: version.name.slice(0, 180),
              kind: "version" as const,
              summary: versionContextSource(version).slice(0, 1_600),
              createdAt: version.createdAt,
            })),
          ],
          artifactRelationships: projectIntelligence.artifactRelationships.slice(-48).map((item) => ({
            ...item,
            label: item.label.slice(0, 300),
          })),
        },
        context: {
          codeLogs: includeLogs ? codeLogs.slice(-12).map((log) => log.slice(0, 1_000)) : [],
          versions: includeVersions
            ? versions.slice(0, 3).map((version) => ({
                id: version.id,
                name: version.name.slice(0, 120),
                mode: version.draft.mode,
                text: versionContextSource(version),
              }))
            : [],
        },
        orchestration: {
          maxSpecialistPasses: reviewDepth === "deep" ? 2 : 1,
          requestedRoles: agentRole === "conductor" ? [] : [agentRole],
        },
        capabilityNegotiation: { requested: [...intelligenceCapabilities] },
      };
      const parsedRequest = intelligenceRunRequestSchema.safeParse(requestCandidate);
      if (!parsedRequest.success) {
        throw new Error(parsedRequest.error.issues[0]?.message ?? "The selected project context exceeds the Agent run contract.");
      }
      const response = await fetch("/api/intelligence/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(parsedRequest.data),
      });
      const rawPayload = await response.json() as unknown;
      if (!response.ok) {
        const message = rawPayload && typeof rawPayload === "object" &&
          "error" in rawPayload && typeof rawPayload.error === "string"
          ? rawPayload.error.slice(0, 500)
          : "The review did not complete.";
        throw new Error(message);
      }
      const parsedPayload = intelligenceRunResponseSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        throw new Error("The Agent returned an invalid review contract. Your source was not changed.");
      }
      const payload: IntelligenceRunResponse = parsedPayload.data;
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
        `${activeProjectId}:${phase}:${agentRole}:${draftFingerprint(nextDraft)}`,
      );
      saveDraftVersion(nextDraft, "agent", `${title || "Untitled"} · Agent proposal`);
      setRunId((value) => value + 1);
    } else {
      const nextDraft = { ...draft, text: review.improvedInput };
      setTextByMode((current) => ({ ...current, [mode]: review.improvedInput }));
      setReviewDraftFingerprint(
        `${activeProjectId}:${phase}:${agentRole}:${draftFingerprint(nextDraft)}`,
      );
      saveDraftVersion(nextDraft, "agent", `${title || "Untitled"} · Agent proposal`);
    }
    let provenanceSaved = true;
    if (reviewResponse && activeProjectId) {
      provenanceSaved = saveProjectIntelligence(activeProjectId, (current) => ({
        ...current,
        agentRuns: [
          ...current.agentRuns,
          {
            id: makeId(),
            role: reviewResponse.agentRole,
            phase,
            source: reviewResponse.source,
            model: reviewResponse.model,
            protocolVersion: reviewResponse.protocolVersion,
            inputDigest: reviewResponse.inputDigest,
            summary: review.summary.slice(0, 2_000),
            artifactIds: [reviewResponse.provenance.finalArtifactId],
            acceptedAt: new Date().toISOString(),
          },
        ].slice(-128),
        updatedAt: new Date().toISOString(),
      }));
    }
    setReviewDraftFingerprint(null);
    setRightTab("preview");
    setMobilePane("preview");
    setStatus(provenanceSaved
      ? "Agent proposal applied as a new version · Provenance accepted into project intelligence"
      : `Agent proposal applied locally. Intelligence warning: ${intelligenceIssueRef.current || "provenance could not be stored"}`);
  };

  const openHandoff = () => {
    setHandoffError("");
    handoffRef.current?.showModal();
  };

  const continueToContact = () => {
    const packageValue = {
      generatedAt: new Date().toISOString(),
      current: draft,
      projectIntelligence: activeIntelligence ? {
        projectId: activeIntelligence.projectId,
        objective: activeIntelligence.objective,
        phase: activeIntelligence.phase,
        evidence: activeIntelligence.evidence.slice(-24),
        decisions: activeIntelligence.decisions.slice(-24),
        acceptedAgentRuns: activeIntelligence.agentRuns.slice(-12),
        artifactRelationships: activeIntelligence.artifactRelationships.slice(-24),
      } : null,
      agentReview:
        handoffAgent && reviewIsCurrent ? reviewResponse?.review ?? null : null,
      versions: handoffVersions ? versions.slice(0, 6) : [],
    };

    try {
      const serialized = JSON.stringify(packageValue);
      if (serialized.length > HANDOFF_CHARACTER_LIMIT) {
        const optionalContext = [
          handoffAgent && reviewIsCurrent ? "Agent review" : "",
          handoffVersions && versions.length ? "version history" : "",
        ].filter(Boolean);
        const recovery = optionalContext.length
          ? ` Turn off ${optionalContext.join(" and ")} and try again, or export the complete project bundle.`
          : " Export the complete project bundle instead.";
        throw new Error(`This build handoff is too large for safe browser transfer.${recovery}`);
      }

      window.sessionStorage.setItem(HANDOFF_KEY, serialized);
      setHandoffError("");
      handoffRef.current?.close();
      router.push("/contact?brief=workspace");
    } catch (error) {
      const message = error instanceof Error && error.message.startsWith("This build handoff")
        ? error.message
        : "This browser could not prepare the private handoff. Your project is unchanged; export it or adjust browser storage settings before trying again.";
      setHandoffError(message);
      setStatus("Build handoff paused · Your Canvas project is unchanged");
    }
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

  const stopSeparatorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const shellStyle = { "--workspace-left": `${paneWidth}%` } as CSSProperties;

  const WorkspaceRoot = embedded ? "section" : "main";

  return (
    <WorkspaceRoot
      className={styles.workspacePage}
      data-embedded={embedded ? "true" : "false"}
      data-mobile-pane={mobilePane}
    >
      <section className={styles.intro} aria-labelledby="canvas-title">
        <div>
          <p>Kingxford Intelligence Workspace · One continuous project system</p>
          {embedded ? (
            <h2 id="canvas-title">Move from first thought to working proof.</h2>
          ) : (
            <h1 id="canvas-title">Move from first thought to working proof.</h1>
          )}
        </div>
        <p>
          Develop an idea, run front-end code, map a system, test a prompt, or
          shape a production brief—with the input and its result always in view.
        </p>
      </section>

      <section className={styles.intelligenceRail} aria-label="Connected project lifecycle">
        <header>
          <div>
            <span>Kingxford Intelligence Conductor</span>
            <strong>{activePhase.outcome}</strong>
          </div>
          <p>{activePhase.action} · the same project context continues forward.</p>
        </header>
        <nav aria-label="Project phases">
          {PLATFORM_LIFECYCLE.map((item) => (
            <button
              type="button"
              aria-current={item.id === phase ? "step" : undefined}
              data-active={item.id === phase ? "true" : "false"}
              onClick={() => selectPhase(item.id)}
              key={item.id}
            >
              <small>{item.index}</small>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <label>
          <span>Specialist pass</span>
          <select
            value={agentRole}
            disabled={reviewRunning}
            onChange={(event) => setAgentRole(event.target.value as PlatformAgentRole)}
          >
            {activeAgents.map((agent) => (
              <option value={agent.id} key={agent.id}>{agent.label}</option>
            ))}
          </select>
        </label>
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
        <div className={styles.topbarStatus}>
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

      <p
        className={styles.workspaceStatus}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isOnline ? status : "Offline · Local previews still work"}
      </p>

      <nav className={styles.mobilePaneTabs} aria-label="Mobile workspace panes">
        {(
          [
            ["input", PanelLeft, "Input"],
            ["preview", PanelRight, "Preview"],
            ["intelligence", Layers3, "Intelligence"],
            ["agent", Bot, "Agent"],
            ["versions", History, `Versions ${versions.length}`],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            type="button"
            aria-pressed={mobilePane === value}
            onClick={() => {
              selectMobilePane(value);
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
                      id={`workspace-code-tab-${value}`}
                      type="button"
                      role="tab"
                      aria-selected={codeFile === value}
                      aria-controls="workspace-code-panel"
                      tabIndex={codeFile === value ? 0 : -1}
                      onClick={() => setCodeFile(value)}
                      onKeyDown={(event) =>
                        handleTabArrow(
                          event,
                          ["html", "css", "javascript"] as const,
                          codeFile,
                          setCodeFile,
                          (nextFile) => `workspace-code-tab-${nextFile}`,
                        )
                      }
                      key={value}
                    >
                      <Icon aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </nav>
                <div
                  id="workspace-code-panel"
                  className={styles.codePanel}
                  role="tabpanel"
                  aria-labelledby={`workspace-code-tab-${codeFile}`}
                >
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
            if (!event.isPrimary || event.button !== 0) return;
            draggingRef.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={handleSeparatorMove}
          onPointerUp={stopSeparatorDrag}
          onPointerCancel={stopSeparatorDrag}
          onLostPointerCapture={() => {
            draggingRef.current = false;
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
                ["intelligence", Layers3, "Project intelligence"],
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
                    ["preview", "intelligence", "agent", "versions"] as const,
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
              key={activeProjectId || "unhydrated-project"}
              draft={draft}
              committedCode={committedCode}
              runId={runId}
              onCodeLogs={setCodeLogs}
              initialMapView={mapView}
              onMapViewCommit={commitMapView}
            />
          </div>
          <div
            id="workspace-intelligence-panel"
            className={styles.resultView}
            role="tabpanel"
            aria-labelledby="workspace-result-tab-intelligence"
            hidden={rightTab !== "intelligence"}
          >
            {activeProjectId && activeIntelligence ? (
              <ProjectIntelligencePanel
                key={activeProjectId}
                projectTitle={title}
                intelligence={activeIntelligence}
                storageError={intelligenceStorageError}
                onChange={(next) => saveProjectIntelligence(
                  activeProjectId,
                  () => next,
                )}
              />
            ) : null}
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
              roleLabel={agentRole === "conductor"
                ? "Conductor"
                : `Conductor + ${PLATFORM_AGENTS.find((item) => item.id === agentRole)?.shortLabel ?? "specialist"}`}
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
          {handoffError ? (
            <p className={styles.handoffError} role="alert">
              {handoffError}
            </p>
          ) : null}
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
    </WorkspaceRoot>
  );
}
