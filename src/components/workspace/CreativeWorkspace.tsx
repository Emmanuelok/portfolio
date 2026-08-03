"use client";

import {
  ArrowRight,
  Bot,
  Braces,
  ChevronRight,
  CircleStop,
  Code2,
  Download,
  FileCode2,
  FileText,
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

import { transformDraft } from "@/lib/workspace/local-analysis";
import {
  initialDraft,
  modeDetails,
  starterText,
  transformLabels,
} from "@/lib/workspace/presets";
import type {
  AgentReviewResponse,
  CodeFiles,
  WorkspaceDraft,
  WorkspaceMode,
  WorkspaceVersion,
} from "@/lib/workspace/types";
import { workspaceModes } from "@/lib/workspace/types";

import { WorkspacePreview } from "./WorkspacePreview";
import styles from "./CreativeWorkspace.module.css";

type TextByMode = Record<Exclude<WorkspaceMode, "code">, string>;
type RightTab = "preview" | "agent" | "versions";
type MobilePane = "input" | "preview" | "agent";
type CodeFileKey = keyof CodeFiles;

type StoredWorkspace = Readonly<{
  mode: WorkspaceMode;
  title: string;
  textByMode: TextByMode;
  code: CodeFiles;
  committedCode: CodeFiles;
  versions: readonly WorkspaceVersion[];
}>;

type CreativeWorkspaceProps = Readonly<{
  entrepreneurshipUrl: string | null;
}>;

const STORAGE_KEY = "kingxford:canvas:v1";
const HANDOFF_KEY = "kingxford:canvas-handoff:v1";
const VERSION_LIMIT = 16;

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

function AgentReviewPanel({
  response,
  isRunning,
  error,
  instruction,
  depth,
  canReview,
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
          <span>GPT-5.6 Sol</span>
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
              <pre>{review.improvedInput}</pre>
            </details>
            <button type="button" onClick={onApply}>
              <WandSparkles aria-hidden="true" />
              Apply as a new version
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
  onSave,
  onRestore,
  onClear,
}: Readonly<{
  versions: readonly WorkspaceVersion[];
  onSave: () => void;
  onRestore: (version: WorkspaceVersion) => void;
  onClear: () => void;
}>) {
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
              <button type="button" onClick={() => onRestore(version)}>
                <RotateCcw aria-hidden="true" />
                Restore copy
              </button>
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

export function CreativeWorkspace({ entrepreneurshipUrl }: CreativeWorkspaceProps) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const handoffRef = useRef<HTMLDialogElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const draggingRef = useRef(false);

  const [mode, setMode] = useState<WorkspaceMode>(initialDraft.mode);
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
  const [reviewInstruction, setReviewInstruction] = useState("");
  const [reviewDepth, setReviewDepth] = useState<"standard" | "deep">("deep");
  const [reviewError, setReviewError] = useState("");
  const [reviewRunning, setReviewRunning] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [includeVersions, setIncludeVersions] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [handoffAgent, setHandoffAgent] = useState(true);
  const [handoffVersions, setHandoffVersions] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const currentText = mode === "code" ? "" : textByMode[mode];
  const draft = useMemo<WorkspaceDraft>(
    () => ({ mode, title, text: currentText, code }),
    [code, currentText, mode, title],
  );
  const canReview = mode === "code"
    ? Boolean(code.html.trim() || code.css.trim() || code.javascript.trim())
    : currentText.trim().length > 2;
  const sourceLength = mode === "code"
    ? code.html.length + code.css.length + code.javascript.length
    : currentText.length;

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    const hydrateFrame = window.requestAnimationFrame(() => {
      setIsOnline(navigator.onLine);
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<StoredWorkspace>;
          if (parsed.mode && workspaceModes.includes(parsed.mode)) setMode(parsed.mode);
          if (typeof parsed.title === "string") setTitle(parsed.title);
          if (parsed.textByMode) setTextByMode(parsed.textByMode);
          if (parsed.code) setCode(parsed.code);
          if (parsed.committedCode) setCommittedCode(parsed.committedCode);
          if (Array.isArray(parsed.versions)) setVersions(parsed.versions.slice(0, VERSION_LIMIT));
        }
      } catch {
        setStatus("A fresh local workspace was opened.");
      }
      setHydrated(true);
    });

    return () => {
      window.cancelAnimationFrame(hydrateFrame);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const saveTimer = window.setTimeout(() => {
      const payload: StoredWorkspace = {
        mode,
        title,
        textByMode,
        code,
        committedCode,
        versions,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setStatus("Saved on this device");
    }, 180);
    return () => window.clearTimeout(saveTimer);
  }, [code, committedCode, hydrated, mode, textByMode, title, versions]);

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

  const saveVersion = useCallback(
    (source: WorkspaceVersion["source"] = "manual", name?: string) => {
      const version: WorkspaceVersion = {
        id: makeId(),
        name: name || title || "Untitled version",
        createdAt: new Date().toISOString(),
        source,
        draft: cloneDraft(draft),
      };
      setVersions((current) => [version, ...current].slice(0, VERSION_LIMIT));
      setStatus(`Checkpoint saved · ${version.name}`);
      return version;
    },
    [draft, title],
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
        setMobilePane((current) => current === "input" ? "preview" : current === "preview" ? "agent" : "input");
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

  const transformTo = (target: WorkspaceMode) => {
    if (target === mode) return;
    const transformed = transformDraft(draft, target);
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
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFileName(title)}-${mode}.${fileExtension(mode)}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${transformLabels[mode].toLocaleLowerCase()}`);
  };

  const requestReview = async (quickInstruction?: string) => {
    if (!canReview || reviewRunning) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setReviewRunning(true);
    setReviewError("");
    setRightTab("agent");
    setMobilePane("agent");
    const objective = quickInstruction || reviewInstruction || "Review this version rigorously and propose the next useful improvement.";

    try {
      const response = await fetch("/api/workspace/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode,
          title,
          text: currentText,
          code,
          objective,
          depth: reviewDepth,
          context: {
            codeLogs: includeLogs ? codeLogs : [],
            versions: includeVersions
              ? versions.slice(0, 3).map((version) => ({
                  name: version.name,
                  mode: version.draft.mode,
                  text: version.draft.text.slice(0, 1800),
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
    if (!review) return;
    saveVersion("agent", `${title || "Untitled"} · before Agent change`);
    if (mode === "code") {
      setCode((current) => ({ ...current, html: review.improvedInput }));
      setCommittedCode((current) => ({ ...current, html: review.improvedInput }));
      setRunId((value) => value + 1);
    } else {
      setTextByMode((current) => ({ ...current, [mode]: review.improvedInput }));
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
      agentReview: handoffAgent ? reviewResponse?.review ?? null : null,
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
        </div>
        <div className={styles.topbarStatus} aria-live="polite">
          <span>{isOnline ? status : "Offline · Local previews still work"}</span>
          <small>Private until you ask the Agent</small>
        </div>
        <div className={styles.topbarActions}>
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
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            type="button"
            aria-pressed={mobilePane === value}
            onClick={() => {
              setMobilePane(value);
              if (value === "preview") setRightTab("preview");
              if (value === "agent") setRightTab("agent");
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
                  title={`${modeDetails[value].label} · Alt+${index + 1}`}
                  onClick={() => switchMode(value)}
                  key={value}
                >
                  <Icon aria-hidden="true" />
                  <span>{modeDetails[value].shortLabel}</span>
                </button>
              );
            })}
          </nav>

          <div className={styles.editorPane}>
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
                type="button"
                role="tab"
                aria-selected={rightTab === value}
                aria-controls={`workspace-${value}-panel`}
                onClick={() => setRightTab(value)}
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
            hidden={rightTab !== "agent"}
          >
            <AgentReviewPanel
              response={reviewResponse}
              isRunning={reviewRunning}
              error={reviewError}
              instruction={reviewInstruction}
              depth={reviewDepth}
              canReview={canReview && isOnline}
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
            hidden={rightTab !== "versions"}
          >
            <VersionPanel
              versions={versions}
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
                checked={handoffAgent && Boolean(reviewResponse)}
                disabled={!reviewResponse}
                onChange={(event) => setHandoffAgent(event.target.checked)}
              />
              Agent review
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
    </main>
  );
}
