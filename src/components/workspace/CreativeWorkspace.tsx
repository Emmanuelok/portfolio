"use client";

import {
  ArrowRight,
  BrainCircuit,
  Bot,
  Braces,
  ChevronRight,
  CircleStop,
  Code2,
  Download,
  FileCode2,
  FileText,
  FolderKanban,
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
  Trash2,
  Upload,
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
import {
  agentLensDetails,
  agentLenses,
  isAgentLens,
  type AgentLens,
} from "@/lib/workspace/lenses";
import { ProjectContinuum } from "@/components/workspace/ProjectContinuum";
import {
  CloudProjectPanel,
  type CloudProjectTransfer,
} from "@/components/workspace/CloudProjectPanel";
import { CloudEvidencePanel } from "@/components/workspace/CloudEvidencePanel";
import { EvidenceIntake } from "@/components/workspace/EvidenceIntake";
import {
  ProjectIntelligencePanel,
  type IntelligenceExecutionMode,
  type ManualEvidenceSubmission,
} from "@/components/workspace/ProjectIntelligencePanel";
import { ProjectLibraryDialog } from "@/components/workspace/ProjectLibraryDialog";
import { WorkflowLibrary } from "@/components/workspace/WorkflowLibrary";
import {
  intelligenceCapabilities,
  intelligenceRunRequestSchema,
  intelligenceRunResponseSchema,
  type IntelligenceRunRequest,
  type IntelligenceRunResponse,
} from "@/lib/intelligence/contracts";
import {
  aiReadinessSchema,
  type AiReadiness,
} from "@/lib/intelligence/readiness";
import type { PlatformPhaseId } from "@/lib/platform";
import { withActiveCloudOrganization } from "@/lib/cloud/organization-selection";
import {
  safeParseCanvasV1,
  type CanvasV1StoredWorkspace,
} from "@/lib/workspace/canvas-project";
import {
  addProjectReviewLink,
  appendArtifactRevision,
  codeRevisionBody,
  connectProjectNodes,
  createKingxfordProject,
  hashRevisionBody,
  parseKingxfordProject,
  recordHumanGateDecision,
  stableHash,
  textRevisionBody,
  upsertProjectNode,
  type ArtifactKind,
  type KingxfordProject,
  type ProjectPhase,
} from "@/lib/workspace/project-graph";
import { buildProjectSnapshot } from "@/lib/workspace/project-snapshot-schema";
import {
  activeRepositoryProject,
  createEmptyProjectRepository,
  duplicateRepositoryProject,
  exportProjectJson,
  importProject,
  importProjectJson,
  loadProjectRepository,
  removeRepositoryProject,
  saveProjectRepository,
  selectRepositoryProject,
  upsertRepositoryProject,
  PROJECT_REPOSITORY_MAX_PROJECTS,
  type ProjectRepositoryState,
} from "@/lib/workspace/project-repository";
import {
  clearProjectSeed,
  readProjectSeed,
  type ProjectSeed,
} from "@/lib/workspace/project-seed";
import {
  addGovernedEvidenceToProject,
  type GovernedEvidence,
} from "@/lib/workspace/evidence-ingestion";
import {
  createWorkflowProject,
  workflowPhaseReadiness,
  workflowTemplateForProject,
  type WorkflowTemplateId,
} from "@/lib/workspace/workflow-templates";
import type {
  AgentReviewRecord,
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
type RightTab = "preview" | "intelligence" | "agent" | "versions";
type MobilePane = "input" | "preview" | "intelligence" | "agent";
type CodeFileKey = keyof CodeFiles;

type StoredWorkspace = Readonly<{
  mode: WorkspaceMode;
  title: string;
  textByMode: TextByMode;
  code: CodeFiles;
  committedCode: CodeFiles;
  versions: readonly WorkspaceVersion[];
  reviewHistory?: readonly AgentReviewRecord[];
  reviewLens?: AgentLens;
  includeKnowledge?: boolean;
}>;

type CreativeWorkspaceProps = Readonly<{
  embedded?: boolean;
  initialMode?: WorkspaceMode | null;
  initialPhase?: PlatformPhaseId | null;
  startFromSeed?: boolean;
}>;

const STORAGE_KEY = "kingxford:canvas:v1";
const HANDOFF_KEY = "kingxford:canvas-handoff:v1";
const VERSION_LIMIT = 16;
const REVIEW_HISTORY_LIMIT = 8;
const DRAFT_AUTOSAVE_DELAY_MS = 900;

const modeProjectDetails: Readonly<Record<WorkspaceMode, Readonly<{
  kind: ArtifactKind;
  phase: ProjectPhase;
  label: string;
}>>> = {
  idea: { kind: "idea", phase: "discovery", label: "Idea" },
  mindmap: { kind: "system-map", phase: "systems", label: "System map" },
  prompt: { kind: "prompt", phase: "prototype", label: "Prompt" },
  code: { kind: "code", phase: "prototype", label: "Code prototype" },
  brief: { kind: "brief", phase: "delivery", label: "Delivery brief" },
};

type ReviewBinding = Readonly<{
  token: string;
  projectId: string;
  snapshotId: string;
  snapshotHash: string;
  artifactId: string;
  artifactRevisionId: string;
  draftHash: string;
  editorHash: string;
  reviewLinkId?: string;
}>;

type IntelligenceBinding = ReviewBinding & Readonly<{
  runId?: string;
  projectUpdatedAt?: string;
}>;

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

function apiErrorMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const error = (value as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function waitForReviewPoll(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Review stopped", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, milliseconds);
    const stop = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Review stopped", "AbortError"));
    };
    signal.addEventListener("abort", stop, { once: true });
  });
}

function cloneDraft(draft: WorkspaceDraft): WorkspaceDraft {
  return {
    ...draft,
    code: { ...draft.code },
  };
}

function projectBodyForDraft(draft: WorkspaceDraft) {
  return draft.mode === "code"
    ? codeRevisionBody(draft.code)
    : textRevisionBody(draft.text);
}

function artifactForProjectMode(project: KingxfordProject, mode: WorkspaceMode) {
  const descriptor = modeProjectDetails[mode];
  return project.artifacts.find(
    (artifact) => artifact.kind === descriptor.kind && artifact.phase === descriptor.phase,
  );
}

function revisionForProjectMode(project: KingxfordProject, mode: WorkspaceMode) {
  const artifact = artifactForProjectMode(project, mode);
  return artifact
    ? project.revisions.find((revision) => revision.id === artifact.activeRevisionId)
    : undefined;
}

function canvasValuesForProject(project: KingxfordProject) {
  const text = (mode: Exclude<WorkspaceMode, "code">) => {
    const body = revisionForProjectMode(project, mode)?.body;
    return body?.type === "text" ? body.text : starterText[mode];
  };
  const codeBody = revisionForProjectMode(project, "code")?.body;
  const projectCode = codeBody?.type === "code"
    ? { html: codeBody.html, css: codeBody.css, javascript: codeBody.javascript }
    : initialDraft.code;
  const activeArtifact = project.activeArtifactId
    ? project.artifacts.find((artifact) => artifact.id === project.activeArtifactId)
    : undefined;
  const activeMode = activeArtifact
    ? workspaceModes.find((candidate) => {
        const details = modeProjectDetails[candidate];
        return details.kind === activeArtifact.kind && details.phase === activeArtifact.phase;
      }) ?? "idea"
    : "idea";
  return {
    mode: activeMode,
    title: project.title,
    textByMode: {
      idea: text("idea"),
      mindmap: text("mindmap"),
      prompt: text("prompt"),
      brief: text("brief"),
    } satisfies TextByMode,
    code: projectCode,
  };
}

function appendDraftToProject(
  project: KingxfordProject,
  draft: WorkspaceDraft,
  source: "human" | "local-transform" | "agent-proposal" | "agent-accepted" | "restored" = "human",
) {
  const activePhase = project.activePhase;
  const descriptor = modeProjectDetails[draft.mode];
  const artifact = project.artifacts.find(
    (candidate) => candidate.kind === descriptor.kind && candidate.phase === descriptor.phase,
  );
  const body = projectBodyForDraft(draft);
  const currentRevision = artifact
    ? project.revisions.find((revision) => revision.id === artifact.activeRevisionId)
    : undefined;
  if (currentRevision?.contentHash === hashRevisionBody(body)) return project;
  const revised = appendArtifactRevision(project, {
    ...(artifact ? { artifactId: artifact.id } : {}),
    kind: descriptor.kind,
    phase: descriptor.phase,
    title: `${project.title} · ${descriptor.label}`,
    body,
    source,
  });
  // Workspace modes are reusable tools, not lifecycle transitions. Adding a
  // brief while validating (for example) must not silently move the project to
  // Delivery; only an explicit phase action changes activePhase.
  return revised.activePhase === activePhase
    ? revised
    : parseKingxfordProject({ ...revised, activePhase });
}

function applyWorkspaceIntent(
  project: KingxfordProject,
  requestedMode: WorkspaceMode | null,
  requestedPhase: PlatformPhaseId | null,
) {
  const requestedArtifact = requestedMode
    ? artifactForProjectMode(project, requestedMode)
    : undefined;
  const activePhase = requestedPhase ?? project.activePhase;
  const activeArtifactId = requestedArtifact?.id ?? project.activeArtifactId;
  if (
    activePhase === project.activePhase
    && activeArtifactId === project.activeArtifactId
  ) {
    return project;
  }
  return parseKingxfordProject({
    ...project,
    activePhase,
    activeArtifactId,
    updatedAt: new Date().toISOString(),
  });
}

function appendDeliberatelyAcceptedDraft(
  project: KingxfordProject,
  draft: WorkspaceDraft,
) {
  const activePhase = project.activePhase;
  const descriptor = modeProjectDetails[draft.mode];
  const artifact = project.artifacts.find(
    (candidate) =>
      candidate.kind === descriptor.kind && candidate.phase === descriptor.phase,
  );
  const revised = appendArtifactRevision(project, {
    ...(artifact ? { artifactId: artifact.id } : {}),
    kind: descriptor.kind,
    phase: descriptor.phase,
    title: `${project.title} · ${descriptor.label}`,
    body: projectBodyForDraft(draft),
    source: "agent-accepted",
  });
  return revised.activePhase === activePhase
    ? revised
    : parseKingxfordProject({ ...revised, activePhase });
}

function revisionSummary(project: KingxfordProject, artifactId: string) {
  const artifact = project.artifacts.find(({ id }) => id === artifactId);
  const revision = artifact
    ? project.revisions.find(({ id }) => id === artifact.activeRevisionId)
    : undefined;
  if (!revision) return "";
  return revision.body.type === "text"
    ? revision.body.text.slice(0, 1_600)
    : [revision.body.html, revision.body.css, revision.body.javascript]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 1_600);
}

function intelligenceProjectContext(
  project: KingxfordProject,
): IntelligenceRunRequest["projectContext"] {
  return {
    projectId: project.id,
    objective: project.summary.slice(0, 600),
    phase: project.activePhase,
    evidence: project.nodes
      .filter((node) => node.kind === "evidence")
      .slice(-6)
      .map((node) => ({
        id: node.id,
        kind: "note" as const,
        title: node.label,
        source: node.sourceRef || "Kingxford project graph",
        claim: node.statement.slice(0, 400),
        addedAt: node.createdAt,
      })),
    decisions: project.decisions.slice(-4).map((decision) => ({
      id: decision.id,
      title: `${decision.phase} gate ${decision.outcome}`,
      decision: decision.outcome.slice(0, 500),
      rationale: decision.rationale.slice(0, 500),
      status: decision.outcome === "approved" ? "accepted" as const : "revisit" as const,
      relatedArtifactIds: decision.evidenceArtifactIds,
      createdAt: decision.provenance.recordedAt,
    })),
    acceptedRuns: [],
    artifacts: project.artifacts.slice(-6).map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      kind: artifact.kind === "evidence" ? "evidence" as const : "workspace-source" as const,
      summary: revisionSummary(project, artifact.id).slice(0, 240),
      createdAt: artifact.createdAt,
    })),
    artifactRelationships: [],
  };
}

function createProjectFromDrafts(
  title: string,
  textByMode: TextByMode,
  code: CodeFiles,
  activeMode: WorkspaceMode,
  requestedPhase: ProjectPhase = modeProjectDetails[activeMode].phase,
) {
  let project = createKingxfordProject({
    title: title.trim() || "Untitled project",
    summary: textByMode.idea.slice(0, 1200),
    activePhase: requestedPhase,
  });
  for (const projectMode of workspaceModes) {
    project = appendDraftToProject(project, {
      mode: projectMode,
      title: project.title,
      text: projectMode === "code" ? "" : textByMode[projectMode],
      code,
    });
  }
  const selectedArtifact = artifactForProjectMode(project, activeMode);
  return parseKingxfordProject({
    ...project,
    activePhase: requestedPhase,
    activeArtifactId: selectedArtifact?.id ?? project.activeArtifactId,
  });
}

function applySeedToProject(
  currentProject: KingxfordProject | null,
  seed: ProjectSeed,
) {
  let project = seed.action === "start-project" || !currentProject
    ? createKingxfordProject({
        title: seed.payload.title,
        summary: seed.payload.brief.slice(0, 1200),
        activePhase: seed.action === "add-evidence" ? "evidence" : "discovery",
        idSeed: `public-seed:${seed.id}`,
      })
    : currentProject;

  if (seed.action === "start-project") {
    project = appendArtifactRevision(project, {
      kind: "idea",
      phase: "discovery",
      title: `${seed.payload.title} · Idea`,
      body: textRevisionBody(seed.payload.brief),
      source: "human",
    });
    project = upsertProjectNode(project, {
      key: `seed-problem:${seed.id}`,
      kind: "problem",
      phase: "discovery",
      label: seed.payload.title,
      statement: seed.payload.brief,
      status: "unresolved",
      sourceRef: seed.source.href,
    });
  }

  const evidence = seed.payload.evidence ?? [];
  if (evidence.length > 0) {
    const artifact = project.artifacts.find(
      (candidate) => candidate.kind === "evidence" && candidate.phase === "evidence",
    );
    const currentRevision = artifact
      ? project.revisions.find((revision) => revision.id === artifact.activeRevisionId)
      : undefined;
    const currentText = currentRevision?.body.type === "text"
      ? currentRevision.body.text.trim()
      : "";
    const incoming = evidence.map((item) => [
      `## ${item.title}`,
      item.content,
      item.sourceUrl ? `Source: ${item.sourceUrl}` : `Source: ${seed.source.href}`,
    ].join("\n")).join("\n\n---\n\n");
    const combined = [currentText, incoming].filter(Boolean).join("\n\n---\n\n");
    project = appendArtifactRevision(project, {
      ...(artifact ? { artifactId: artifact.id } : {}),
      kind: "evidence",
      phase: "evidence",
      title: `${project.title} · Evidence register`,
      body: textRevisionBody(combined.slice(0, 60_000)),
      source: "human",
    });
    for (const [index, item] of evidence.entries()) {
      project = upsertProjectNode(project, {
        key: `seed-evidence:${seed.id}:${index}`,
        kind: "evidence",
        phase: "evidence",
        label: item.title,
        statement: item.content,
        status: "known",
        sourceRef: item.sourceUrl ?? seed.source.href,
      });
    }
  }

  return parseKingxfordProject(project);
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
    .replace(/-sol$/i, " Sol")
    .replace(/-terra$/i, " Terra")
    .replace(/-luna$/i, " Luna");
}

function formatDuration(milliseconds: number) {
  return milliseconds < 1000
    ? `${Math.max(0, Math.round(milliseconds))} ms`
    : `${(milliseconds / 1000).toFixed(1)} s`;
}

function formatTokens(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "Not reported";
}

function handleRovingTabKey(event: KeyboardEvent<HTMLButtonElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    return;
  }
  const tabs = event.currentTarget.parentElement
    ? [...event.currentTarget.parentElement.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    : [];
  if (!tabs.length) return;
  const currentIndex = Math.max(0, tabs.indexOf(event.currentTarget));
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : (currentIndex + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1) + tabs.length) % tabs.length;
  event.preventDefault();
  tabs[nextIndex]?.focus();
  tabs[nextIndex]?.click();
}

function isAgentReviewRecord(value: unknown): value is AgentReviewRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AgentReviewRecord>;
  return Boolean(
    typeof candidate.id === "string"
      && typeof candidate.createdAt === "string"
      && typeof candidate.projectTitle === "string"
      && Boolean(candidate.mode && workspaceModes.includes(candidate.mode))
      && typeof candidate.instruction === "string"
      && candidate.response?.review
      && isAgentLens(candidate.response.agent?.id)
      && candidate.response.request,
  );
}

function AgentReviewPanel({
  response,
  isRunning,
  error,
  instruction,
  depth,
  lens,
  canReview,
  includeLogs,
  includeVersions,
  includeKnowledge,
  includeProjectGraph,
  reviewHistory,
  onInstruction,
  onDepth,
  onLens,
  onIncludeLogs,
  onIncludeVersions,
  onIncludeKnowledge,
  onIncludeProjectGraph,
  onReview,
  onStop,
  onApply,
  canApply,
  onOpenHistory,
  onClearHistory,
}: Readonly<{
  response: AgentReviewResponse | null;
  isRunning: boolean;
  error: string;
  instruction: string;
  depth: "standard" | "deep";
  lens: AgentLens;
  canReview: boolean;
  includeLogs: boolean;
  includeVersions: boolean;
  includeKnowledge: boolean;
  includeProjectGraph: boolean;
  reviewHistory: readonly AgentReviewRecord[];
  onInstruction: (value: string) => void;
  onDepth: (value: "standard" | "deep") => void;
  onLens: (value: AgentLens) => void;
  onIncludeLogs: (value: boolean) => void;
  onIncludeVersions: (value: boolean) => void;
  onIncludeKnowledge: (value: boolean) => void;
  onIncludeProjectGraph: (value: boolean) => void;
  onReview: (instruction?: string) => void;
  onStop: () => void;
  onApply: () => void;
  canApply: boolean;
  onOpenHistory: (record: AgentReviewRecord) => void;
  onClearHistory: () => void;
}>) {
  const review = response?.review;
  const lensDetail = agentLensDetails[lens];

  return (
    <section className={styles.agentPanel} aria-labelledby="agent-panel-heading">
      <header className={styles.agentHeading}>
        <div className={styles.agentIdentity}>
          <span className={styles.agentMark}><Sparkles aria-hidden="true" /></span>
          <div>
            <span>Kingxford Review</span>
            <h2 id="agent-panel-heading">Focused project review</h2>
          </div>
        </div>
        <div className={styles.agentProtocol}>
          <span>
            {response?.source === "openai"
              ? formatAgentModel(response.model)
              : depth === "deep"
                ? "Deep reasoning route"
                : "Standard reasoning route"}
          </span>
          <small>{response?.agent.label ?? lensDetail.label}</small>
        </div>
      </header>

      <div className={styles.agentTruth}>
        <Bot aria-hidden="true" />
        <p>
          AI output may be incorrect. Reviews cannot change your project
          automatically, run tools, or approve a gate. Release checks verify these
          controls.
        </p>
      </div>

      <div className={styles.lensSelector}>
        <label htmlFor="agent-lens">
          <span>Specialist lens</span>
          <select
            id="agent-lens"
            value={lens}
            disabled={isRunning}
            onChange={(event) => onLens(event.target.value as AgentLens)}
          >
            {agentLenses.map((value) => (
              <option value={value} key={value}>
                {agentLensDetails[value].label}
              </option>
            ))}
          </select>
        </label>
        <p>
          <strong>{lensDetail.shortLabel}</strong>
          {lensDetail.description}
        </p>
      </div>

      {!review && !isRunning && (
        <div className={styles.agentEmpty}>
          <span>Project review</span>
          <h3>Review the current version.</h3>
          <p>
            Use a focused review to identify assumptions, risks, unclear areas, and
            a practical next test. Suggested edits remain proposals until you apply them.
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
            <strong>Reviewing this version…</strong>
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
              <small>{response.source === "openai" ? "AI-assisted review" : "Local rule-based review"}</small>
            </div>
            <p>{review.summary}</p>
          </div>

          {response.notice && <p className={styles.reviewNotice}>{response.notice}</p>}

          <section className={styles.reviewProvenance} aria-label="Review provenance and usage">
            <div>
              <span>Specialist</span>
              <strong>{response.agent.label}</strong>
            </div>
            <div>
              <span>Completed in</span>
              <strong>{formatDuration(response.request.durationMs)}</strong>
            </div>
            <div>
              <span>Total tokens</span>
              <strong>{formatTokens(response.usage?.totalTokens)}</strong>
            </div>
            <div>
              <span>Daily AI allowance</span>
              <strong>
                {response.limits
                  ? `${response.limits.dailyCreditsRemaining} remaining`
                  : "Not metered"}
              </strong>
            </div>
            <div>
              <span>Project snapshot</span>
              <strong>
                {response.projectContext
                  ? `${response.projectContext.counts.artifacts} artifacts · bound`
                  : "Not shared"}
              </strong>
            </div>
          </section>

          {response.grounding.length > 0 && (
            <details className={styles.reviewGrounding}>
              <summary>
                Kingxford playbook notes
                <span>{response.grounding.length} notes</span>
              </summary>
              <ul>
                {response.grounding.map((item) => (
                  <li key={item.id}>
                    <span>{item.id}</span>
                    {item.title}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className={styles.reviewRequestId}>
            Request <code>{response.request.id}</code>
            <span>{response.request.depth} review · protocol {response.protocolVersion}</span>
          </p>

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
            <span>Recommended next test</span>
            <p>{review.nextTest}</p>
          </section>

          <section className={styles.proposedChanges}>
            <span>Proposed changes</span>
            <ol>
              {review.proposedChanges.map((change) => <li key={change}>{change}</li>)}
            </ol>
            <details>
              <summary>Inspect proposed source</summary>
              {review.proposedCode ? (
                <div>
                  <strong>HTML</strong>
                  <pre>{review.proposedCode.html}</pre>
                  <strong>CSS</strong>
                  <pre>{review.proposedCode.css}</pre>
                  <strong>JavaScript</strong>
                  <pre>{review.proposedCode.javascript}</pre>
                </div>
              ) : (
                <pre>{review.improvedInput}</pre>
              )}
            </details>
            <button type="button" disabled={!canApply} onClick={onApply}>
              <WandSparkles aria-hidden="true" />
              {canApply ? "Apply as a new version" : "Review the current revision before applying"}
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
        <label htmlFor="agent-instruction">What should the review focus on?</label>
        <textarea
          id="agent-instruction"
          value={instruction}
          rows={3}
          placeholder="Identify the main assumption, risk, or next test…"
          onChange={(event) => onInstruction(event.target.value)}
        />
        <div className={styles.agentContext}>
          <div>
            <span>Select the context to include</span>
            <label><input type="checkbox" checked readOnly /> Current input</label>
            <label title="Retrieve relevant notes from Kingxford's fixed, versioned playbook.">
              <input
                type="checkbox"
                checked={includeKnowledge}
                onChange={(event) => onIncludeKnowledge(event.target.checked)}
              />
              Kingxford playbook
            </label>
            <label title="Share a bounded, integrity-checked snapshot of this local project graph.">
              <input
                type="checkbox"
                checked={includeProjectGraph}
                onChange={(event) => onIncludeProjectGraph(event.target.checked)}
              />
              Bounded project graph
            </label>
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
          Only the selected context and project snapshot are sent when you choose
          Review. The snapshot is reference material, not instructions. Remove
          secrets and confidential information before continuing.
        </p>
      </div>

      {reviewHistory.length > 0 && (
        <details className={styles.reviewHistory}>
          <summary>
            <span>Review history</span>
            <strong>{reviewHistory.length} / {REVIEW_HISTORY_LIMIT}</strong>
          </summary>
          <div className={styles.reviewHistoryHeading}>
            <p>Saved in this browser only. Open a prior review without sending anything.</p>
            <button type="button" onClick={onClearHistory}>Clear</button>
          </div>
          <ol>
            {reviewHistory.map((record) => (
              <li key={record.id}>
                <button type="button" onClick={() => onOpenHistory(record)}>
                  <span>
                    {record.response.agent.label}
                    <time dateTime={record.createdAt}>{formatTime(record.createdAt)}</time>
                  </span>
                  <strong>{record.projectTitle || "Untitled concept"}</strong>
                  <small>{record.instruction}</small>
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}
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
          <p>Saved checkpoints and applied proposals appear here.</p>
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
  embedded = false,
  initialMode = null,
  initialPhase = null,
}: CreativeWorkspaceProps) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const handoffRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const intelligenceControllerRef = useRef<AbortController | null>(null);
  const durableWorkflowRunRef = useRef<string | null>(null);
  const reviewBindingRef = useRef<ReviewBinding | null>(null);
  const intelligenceBindingRef = useRef<IntelligenceBinding | null>(null);
  const editorHashRef = useRef("");
  const activeProjectRef = useRef<KingxfordProject | null>(null);
  const seedHandledRef = useRef(false);
  const draggingRef = useRef(false);
  const initialConfigurationRef = useRef({
    mode: initialMode,
    phase: initialPhase,
  });
  const appliedRouteIntentRef = useRef(
    `${initialMode ?? ""}|${initialPhase ?? ""}`,
  );

  const [mode, setMode] = useState<WorkspaceMode>(
    () => initialMode ?? initialDraft.mode,
  );
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
  const [reviewHistory, setReviewHistory] = useState<readonly AgentReviewRecord[]>([]);
  const [reviewInstruction, setReviewInstruction] = useState("");
  const [reviewDepth, setReviewDepth] = useState<"standard" | "deep">("standard");
  const [reviewLens, setReviewLens] = useState<AgentLens>("conductor");
  const [reviewError, setReviewError] = useState("");
  const [reviewRunning, setReviewRunning] = useState(false);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [includeVersions, setIncludeVersions] = useState(false);
  const [includeKnowledge, setIncludeKnowledge] = useState(true);
  const [includeProjectGraph, setIncludeProjectGraph] = useState(true);
  const [activeProject, setActiveProject] = useState<KingxfordProject | null>(null);
  const [projectRepository, setProjectRepository] = useState<ProjectRepositoryState>(
    createEmptyProjectRepository,
  );
  const [reviewBinding, setReviewBinding] = useState<ReviewBinding | null>(null);
  const [intelligenceResponse, setIntelligenceResponse] = useState<IntelligenceRunResponse | null>(null);
  const [intelligenceBinding, setIntelligenceBinding] = useState<IntelligenceBinding | null>(null);
  const [intelligenceDepth, setIntelligenceDepth] = useState<"standard" | "deep">("standard");
  const [intelligenceExecution, setIntelligenceExecution] = useState<IntelligenceExecutionMode>("immediate");
  const [intelligenceRunning, setIntelligenceRunning] = useState(false);
  const [intelligenceAccepting, setIntelligenceAccepting] = useState(false);
  const [intelligenceError, setIntelligenceError] = useState("");
  const [projectLibraryOpen, setProjectLibraryOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [aiReadiness, setAiReadiness] = useState<AiReadiness | null>(null);
  const [aiReadinessChecked, setAiReadinessChecked] = useState(false);
  const [handoffAgent, setHandoffAgent] = useState(true);
  const [handoffVersions, setHandoffVersions] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const projectMutationLocked = reviewRunning || intelligenceRunning;

  const refreshAiReadiness = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/intelligence/runs", {
      method: "GET",
      cache: "no-store",
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Review readiness could not be confirmed.");
    const payload = await response.json() as unknown;
    const readinessValue = payload && typeof payload === "object" && "readiness" in payload
      ? (payload as { readiness?: unknown }).readiness
      : undefined;
    const readiness = aiReadinessSchema.parse(readinessValue);
    setAiReadiness(readiness);
    setAiReadinessChecked(true);
    return readiness;
  }, []);

  const reviewAvailability = useMemo(() => {
    if (!aiReadinessChecked) {
      return {
        ready: false,
        state: "checking" as const,
        label: "Checking review availability",
        detail: "No project content is included in this configuration check.",
      };
    }
    if (aiReadiness?.deploymentReady && aiReadiness.providerReady) {
      return {
        ready: true,
        state: "ai" as const,
        label: "AI-assisted review available",
        detail: "Provider routing is configured. A live connection is attempted only when you start a review.",
      };
    }
    if (aiReadiness?.localFallbackReady) {
      return {
        ready: true,
        state: "local" as const,
        label: "Local review available",
        detail: "Reviews use local rules without provider transmission.",
      };
    }
    return {
      ready: false,
      state: "blocked" as const,
      label: "Configuration required",
      detail: aiReadiness?.blockers[0]?.message
        ?? "Review configuration is unavailable. Local editing, evidence intake, and export remain available.",
    };
  }, [aiReadiness, aiReadinessChecked]);

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
  const editorHash = useMemo(() => stableHash(draft), [draft]);
  const activeArtifact = useMemo(() => {
    if (!activeProject) return undefined;
    const descriptor = modeProjectDetails[mode];
    return activeProject.artifacts.find(
      (artifact) => artifact.kind === descriptor.kind && artifact.phase === descriptor.phase,
    );
  }, [activeProject, mode]);
  const activeWorkflowTemplate = useMemo(
    () => activeProject ? workflowTemplateForProject(activeProject) : null,
    [activeProject],
  );
  const intelligenceBindingIsCurrent = useMemo(() => {
    if (!activeProject || !intelligenceBinding || !intelligenceResponse) return false;
    const artifact = activeProject.artifacts.find(
      ({ id }) => id === intelligenceBinding.artifactId,
    );
    if (
      activeProject.id !== intelligenceBinding.projectId
      || artifact?.activeRevisionId !== intelligenceBinding.artifactRevisionId
      || editorHash !== intelligenceBinding.editorHash
      || intelligenceResponse.runId !== intelligenceBinding.runId
      || activeProject.updatedAt !== intelligenceBinding.projectUpdatedAt
    ) {
      return false;
    }
    return intelligenceResponse.projectContext.snapshotId === intelligenceBinding.snapshotId
      && intelligenceResponse.projectContext.snapshotHash === intelligenceBinding.snapshotHash;
  }, [activeProject, editorHash, intelligenceBinding, intelligenceResponse]);

  const persistProject = useCallback((project: KingxfordProject) => {
    activeProjectRef.current = project;
    setActiveProject(project);
    setProjectRepository((current) => {
      try {
        const next = upsertRepositoryProject(current, project);
        saveProjectRepository(next);
        return next;
      } catch (error) {
        setStatus(error instanceof Error
          ? `Local project save blocked · ${error.message}`
          : "Local project save blocked.");
        return current;
      }
    });
  }, []);

  useEffect(() => {
    editorHashRef.current = editorHash;
    activeProjectRef.current = activeProject;
  }, [activeProject, editorHash]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    intelligenceControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void refreshAiReadiness(controller.signal).catch(() => {
        if (controller.signal.aborted) return;
        setAiReadiness(null);
        setAiReadinessChecked(true);
      });
    });
    return () => controller.abort();
  }, [refreshAiReadiness]);

  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);

    const hydrateFrame = window.requestAnimationFrame(() => {
      setIsOnline(navigator.onLine);
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        let legacyWorkspace: CanvasV1StoredWorkspace | undefined;
        if (stored) {
          const raw = JSON.parse(stored) as unknown;
          const result = safeParseCanvasV1(raw);
          if (result.success) {
            legacyWorkspace = result.data;
            const parsed = result.data;
            setVersions(parsed.versions.slice(0, VERSION_LIMIT));
            if (parsed.reviewHistory) {
              setReviewHistory(
                parsed.reviewHistory
                  .filter(isAgentReviewRecord)
                  .slice(0, REVIEW_HISTORY_LIMIT),
              );
            }
            if (isAgentLens(parsed.reviewLens)) setReviewLens(parsed.reviewLens);
            if (typeof parsed.includeKnowledge === "boolean") {
              setIncludeKnowledge(parsed.includeKnowledge);
            }
          }
        }

        let repository = loadProjectRepository();
        let project = activeRepositoryProject(repository);
        if (!project) {
          project = legacyWorkspace
            ? createProjectFromDrafts(
                legacyWorkspace.title,
                legacyWorkspace.textByMode,
                legacyWorkspace.code,
                legacyWorkspace.mode,
              )
            : createProjectFromDrafts(
                initialDraft.title,
                {
                  idea: starterText.idea,
                  mindmap: starterText.mindmap,
                  prompt: starterText.prompt,
                  brief: starterText.brief,
                },
                initialDraft.code,
                initialConfigurationRef.current.mode ?? initialDraft.mode,
                initialConfigurationRef.current.phase
                  ?? modeProjectDetails[initialConfigurationRef.current.mode ?? initialDraft.mode].phase,
              );
          repository = upsertRepositoryProject(repository, project);
          saveProjectRepository(repository);
        }

        const intendedProject = applyWorkspaceIntent(
          project,
          initialConfigurationRef.current.mode,
          initialConfigurationRef.current.phase,
        );
        if (intendedProject !== project) {
          project = intendedProject;
          repository = upsertRepositoryProject(repository, project);
          saveProjectRepository(repository);
        }
        const canvas = canvasValuesForProject(project);
        setMode(canvas.mode);
        setTitle(canvas.title);
        setTextByMode(canvas.textByMode);
        setCode(canvas.code);
        setCommittedCode(canvas.code);
        setProjectRepository(repository);
        setActiveProject(project);
      } catch {
        setStatus("A fresh local workspace was opened.");
        const project = createProjectFromDrafts(
          initialDraft.title,
          {
            idea: starterText.idea,
            mindmap: starterText.mindmap,
            prompt: starterText.prompt,
            brief: starterText.brief,
          },
          initialDraft.code,
          initialConfigurationRef.current.mode ?? initialDraft.mode,
          initialConfigurationRef.current.phase
            ?? modeProjectDetails[initialConfigurationRef.current.mode ?? initialDraft.mode].phase,
        );
        setProjectRepository(upsertRepositoryProject(createEmptyProjectRepository(), project));
        setActiveProject(project);
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
    if (!hydrated || seedHandledRef.current) return;
    seedHandledRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      const seed = readProjectSeed();
      if (!seed) return;
      try {
        const seededProject = applySeedToProject(activeProject, seed);
        persistProject(seededProject);
        setTitle(seededProject.title);
        if (seed.action === "start-project") {
          setMode("idea");
          setTextByMode((current) => ({ ...current, idea: seed.payload.brief }));
        }
        clearProjectSeed(seed.id);
        setStatus(
          seed.action === "add-evidence"
            ? `Evidence added from ${seed.source.label}`
            : `Project started from ${seed.source.label}`,
        );
      } catch {
        setStatus("The incoming project could not be opened. A recovery copy was retained.");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeProject, hydrated, persistProject]);

  useEffect(() => {
    if (!hydrated || !activeProject) return;
    const saveTimer = window.setTimeout(() => {
      const payload: StoredWorkspace = {
        mode,
        title,
        textByMode,
        code,
        committedCode,
        versions,
        reviewHistory,
        reviewLens,
        includeKnowledge,
      };
      let recoverySaved = false;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        recoverySaved = true;
      } catch {
        // The canonical Atlas write below can still succeed when the legacy
        // compatibility copy cannot be retained.
      }

      try {
        const titled = activeProject.title === (title.trim() || activeProject.title)
          && (mode !== "idea" || activeProject.summary === currentText.slice(0, 1200))
          ? activeProject
          : parseKingxfordProject({
              ...activeProject,
              title: (title.trim() || activeProject.title).slice(0, 160),
              summary: mode === "idea"
                ? currentText.slice(0, 1200)
                : activeProject.summary,
              updatedAt: new Date().toISOString(),
            });
        const project = appendDraftToProject(titled, draft, "human");
        if (project !== activeProject) {
          const repository = upsertRepositoryProject(projectRepository, project);
          saveProjectRepository(repository);
          activeProjectRef.current = project;
          setActiveProject(project);
          setProjectRepository(repository);
          setStatus("Saved to Project Atlas · recovery copy retained on this device");
        }
      } catch (error) {
        setStatus(
          recoverySaved
            ? `Atlas save blocked · recovery copy retained · ${error instanceof Error ? error.message : "export the project now"}`
            : "Local project storage is unavailable. Export the project package now.",
        );
      }
    }, DRAFT_AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(saveTimer);
  }, [
    activeProject,
    code,
    committedCode,
    currentText,
    draft,
    hydrated,
    includeKnowledge,
    mode,
    reviewHistory,
    reviewLens,
    projectRepository,
    textByMode,
    title,
    versions,
  ]);

  useEffect(() => {
    if (!hydrated || !activeProject) return;
    const intentKey = `${initialMode ?? ""}|${initialPhase ?? ""}`;
    if (appliedRouteIntentRef.current === intentKey) return;
    appliedRouteIntentRef.current = intentKey;
    if (!initialMode && !initialPhase) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        const project = applyWorkspaceIntent(activeProject, initialMode, initialPhase);
        if (project !== activeProject) {
          const repository = upsertRepositoryProject(projectRepository, project);
          saveProjectRepository(repository);
          activeProjectRef.current = project;
          setActiveProject(project);
          setProjectRepository(repository);
        }
        if (initialMode) setMode(initialMode);
        setStatus("Opened the selected Canvas mode and project phase");
      } catch (error) {
        setStatus(error instanceof Error
          ? `Workspace route could not be applied · ${error.message}`
          : "Workspace route could not be applied safely.");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeProject, hydrated, initialMode, initialPhase, projectRepository]);

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

  const commitDraftToProject = useCallback((
    nextDraft: WorkspaceDraft,
    source: "human" | "local-transform" | "agent-proposal" | "agent-accepted" | "restored" = "human",
  ) => {
    try {
      const base = activeProject ?? createKingxfordProject({
        title: nextDraft.title || "Untitled project",
        summary: nextDraft.mode === "idea" ? nextDraft.text.slice(0, 1200) : "",
        activePhase: modeProjectDetails[nextDraft.mode].phase,
      });
      const titled = parseKingxfordProject({
        ...base,
        title: (nextDraft.title.trim() || base.title).slice(0, 160),
        summary: nextDraft.mode === "idea"
          ? nextDraft.text.slice(0, 1200)
          : base.summary,
        updatedAt: new Date().toISOString(),
      });
      const next = appendDraftToProject(titled, nextDraft, source);
      persistProject(next);
      return next;
    } catch (error) {
      setStatus(error instanceof Error
        ? `Project revision blocked · ${error.message}`
        : "Project revision could not be saved.");
      return null;
    }
  }, [activeProject, persistProject]);

  const openProjectInCanvas = useCallback((project: KingxfordProject) => {
    const canvas = canvasValuesForProject(project);
    setActiveProject(project);
    setMode(canvas.mode);
    setTitle(canvas.title);
    setTextByMode(canvas.textByMode);
    setCode(canvas.code);
    setCommittedCode(canvas.code);
    setReviewResponse(null);
    setReviewBinding(null);
    reviewBindingRef.current = null;
    setIntelligenceResponse(null);
    setIntelligenceBinding(null);
    setIntelligenceError("");
    intelligenceBindingRef.current = null;
    setRightTab("preview");
    setMobilePane("input");
  }, []);

  const preserveCurrentProject = useCallback(() => {
    if (!activeProject) return projectRepository;
    const titled = parseKingxfordProject({
      ...activeProject,
      title: (title.trim() || activeProject.title).slice(0, 160),
      summary: mode === "idea" ? currentText.slice(0, 1200) : activeProject.summary,
      updatedAt: new Date().toISOString(),
    });
    const project = appendDraftToProject(titled, draft, "human");
    const repository = upsertRepositoryProject(projectRepository, project);
    saveProjectRepository(repository);
    setProjectRepository(repository);
    setActiveProject(project);
    return repository;
  }, [activeProject, currentText, draft, mode, projectRepository, title]);

  const switchProject = (projectId: string) => {
    if (projectMutationLocked || projectId === activeProject?.id) return;
    try {
      const preserved = preserveCurrentProject();
      const repository = selectRepositoryProject(preserved, projectId);
      const project = activeRepositoryProject(repository);
      if (!project) throw new Error("The selected project is unavailable.");
      saveProjectRepository(repository);
      setProjectRepository(repository);
      openProjectInCanvas(project);
      setStatus(`Opened ${project.title}`);
    } catch (error) {
      setStatus(error instanceof Error
        ? `Project switch blocked · ${error.message}`
        : "Project switch blocked to protect the current draft.");
    }
  };

  const createLocalProject = () => {
    if (projectMutationLocked) return;
    try {
      let repository = preserveCurrentProject();
      const project = createProjectFromDrafts(
        "New Kingxford project",
        {
          idea: starterText.idea,
          mindmap: starterText.mindmap,
          prompt: starterText.prompt,
          brief: starterText.brief,
        },
        initialDraft.code,
        "idea",
      );
      repository = upsertRepositoryProject(repository, project);
      saveProjectRepository(repository);
      setProjectRepository(repository);
      openProjectInCanvas(project);
      setStatus("New local project created");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "A new project could not be created.");
    }
  };

  const startWorkflow = (templateId: WorkflowTemplateId, projectTitle: string) => {
    if (projectMutationLocked) return;
    if (projectRepository.projects.length >= PROJECT_REPOSITORY_MAX_PROJECTS) {
      setStatus(`The local library is full. Export or delete a project before starting another workflow.`);
      return;
    }
    try {
      let repository = preserveCurrentProject();
      const project = createWorkflowProject(templateId, {
        title: projectTitle,
        idSeed: `workflow:${templateId}:${makeId()}`,
      });
      repository = upsertRepositoryProject(repository, project);
      saveProjectRepository(repository);
      setProjectRepository(repository);
      openProjectInCanvas(project);
      setStatus(`${workflowTemplateForProject(project)?.name ?? "Atlas"} workflow started as a new local project`);
    } catch (error) {
      setStatus(error instanceof Error
        ? `Workflow could not be started · ${error.message}`
        : "Workflow could not be started. The current project remains unchanged.");
    }
  };

  const exportProjectPackage = (projectId = activeProject?.id) => {
    if (!projectId) return;
    try {
      const storedProject = projectRepository.projects.find(({ id }) => id === projectId);
      if (!storedProject) throw new Error("The selected project is unavailable.");
      const project = projectId === activeProject?.id
        ? appendDraftToProject(activeProject, draft, "human")
        : storedProject;
      if (projectId === activeProject?.id) persistProject(project);
      const blob = new Blob([exportProjectJson(project)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFileName(project.title)}.kxproject.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Project file exported");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The project file could not be exported.");
    }
  };

  const importProjectPackage = async (file: File | undefined) => {
    if (!file || projectMutationLocked) return;
    try {
      const preserved = preserveCurrentProject();
      const result = importProjectJson(preserved, await file.text());
      saveProjectRepository(result.state);
      setProjectRepository(result.state);
      openProjectInCanvas(result.project);
      setStatus(result.cloned
        ? "Imported as a protected copy; the existing project was preserved"
        : "Project file imported and validated");
    } catch (error) {
      setStatus(error instanceof Error
        ? `Import rejected · ${error.message}`
        : "The project file did not pass validation.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const receiveCloudProject = async (transfer: CloudProjectTransfer) => {
    if (projectMutationLocked) {
      throw new Error("Wait for the current review to finish before opening a cloud project.");
    }
    try {
      const preserved = preserveCurrentProject();
      if (transfer.intent === "inspect-current-copy") {
        const local = preserved.projects.find(({ id }) => id === transfer.project.id);
        if (!local) throw new Error("The matching local project is no longer available.");
        const repository = selectRepositoryProject(preserved, local.id);
        saveProjectRepository(repository);
        setProjectRepository(repository);
        openProjectInCanvas(local);
        setStatus("Verified cloud and local versions match");
        return;
      }

      const result = importProject(preserved, transfer.project);
      saveProjectRepository(result.state);
      setProjectRepository(result.state);
      openProjectInCanvas(result.project);
      setStatus(result.cloned
        ? "Cloud version opened as a protected local copy for comparison"
        : "Cloud project added to this device and opened");
    } catch (error) {
      setStatus(error instanceof Error
        ? `Cloud project could not be opened · ${error.message}`
        : "The cloud project could not be opened. Local work remains unchanged.");
      throw error;
    }
  };

  const deleteCurrentProject = () => {
    if (!activeProject || projectMutationLocked || projectRepository.projects.length < 2) return;
    if (!window.confirm(`Delete the local project “${activeProject.title}”? Export it first if you may need it later.`)) return;
    try {
      const repository = removeRepositoryProject(projectRepository, activeProject.id);
      const next = activeRepositoryProject(repository);
      if (!next) throw new Error("At least one project must remain in Canvas.");
      saveProjectRepository(repository);
      setProjectRepository(repository);
      openProjectInCanvas(next);
      setStatus("Local project deleted");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The project could not be deleted.");
    }
  };

  const duplicateLocalProject = (projectId: string) => {
    if (projectMutationLocked) return;
    try {
      const preserved = preserveCurrentProject();
      const result = duplicateRepositoryProject(preserved, projectId);
      saveProjectRepository(result.state);
      setProjectRepository(result.state);
      openProjectInCanvas(result.project);
      setStatus(`Duplicated ${result.project.title} with its project history`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The project could not be duplicated.");
    }
  };

  const deleteLibraryProject = (projectId: string) => {
    if (projectMutationLocked || projectRepository.projects.length < 2) return;
    try {
      const repository = removeRepositoryProject(projectRepository, projectId);
      const next = activeRepositoryProject(repository);
      if (!next) throw new Error("At least one project must remain in Canvas.");
      saveProjectRepository(repository);
      setProjectRepository(repository);
      if (projectId === activeProject?.id) openProjectInCanvas(next);
      setStatus("Project deleted from this device");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The project could not be deleted.");
    }
  };

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
      commitDraftToProject(draft, source === "restored" ? "restored" : "human");
      setStatus(`Version saved · ${version.name}`);
      return version;
    },
    [commitDraftToProject, draft, title],
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
    setStatus(`${modeDetails[nextMode].label} editor open`);
  };

  const transformTo = (target: WorkspaceMode) => {
    if (target === mode) return;
    const transformed = transformDraft(draft, target);
    try {
      const base = appendDraftToProject(
        activeProject ?? createKingxfordProject({ title: title || "Untitled project" }),
        draft,
        "human",
      );
      let next = appendDraftToProject(base, transformed, "local-transform");
      const sourceRevision = revisionForProjectMode(next, mode);
      const targetRevision = revisionForProjectMode(next, target);
      const sourceNode = sourceRevision
        ? next.nodes.find((node) => node.kind === "revision" && node.refId === sourceRevision.id)
        : undefined;
      const targetNode = targetRevision
        ? next.nodes.find((node) => node.kind === "revision" && node.refId === targetRevision.id)
        : undefined;
      if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
        next = connectProjectNodes(next, {
          type: "derives-from",
          fromNodeId: targetNode.id,
          toNodeId: sourceNode.id,
        });
      }
      persistProject(next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The converted draft could not be saved.");
      return;
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
    setStatus(`Created ${transformLabels[target].toLocaleLowerCase()} from the current draft`);
  };

  const restoreVersion = (version: WorkspaceVersion) => {
    saveVersion("restored", `${title || "Untitled"} · before restore`);
    commitDraftToProject(version.draft, "restored");
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
    setStatus(`Restored ${version.name} as a new version`);
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
    if (!canReview || projectMutationLocked || !isOnline) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setReviewRunning(true);
    setReviewError("");
    setReviewResponse(null);
    setReviewBinding(null);
    setRightTab("agent");
    setMobilePane("agent");
    const objective = quickInstruction || reviewInstruction || "Review this version rigorously and propose the next useful improvement.";

    try {
      const readiness = await refreshAiReadiness(controller.signal);
      if (!readiness.deploymentReady && !readiness.localFallbackReady) {
        throw new Error(readiness.blockers[0]?.message ?? "Review configuration is required before any project content can be transmitted.");
      }
      const project = commitDraftToProject(draft, "human");
      if (!project) throw new Error("The current draft could not be bound to a project revision.");
      const artifact = artifactForProjectMode(project, mode);
      const revision = artifact
        ? project.revisions.find((candidate) => candidate.id === artifact.activeRevisionId)
        : undefined;
      if (!artifact || !revision) {
        throw new Error("The active artifact revision could not be prepared for review.");
      }
      const snapshot = buildProjectSnapshot(project, { activeArtifactId: artifact.id });
      const binding: ReviewBinding = {
        token: makeId(),
        projectId: project.id,
        snapshotId: snapshot.id,
        snapshotHash: snapshot.hash,
        artifactId: artifact.id,
        artifactRevisionId: revision.id,
        draftHash: revision.contentHash,
        editorHash,
      };
      reviewBindingRef.current = binding;
      setReviewBinding(null);

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
          lens: reviewLens,
          includeKnowledge,
          ...(includeProjectGraph
            ? {
                projectGraphSnapshot: snapshot,
                artifactRevisionId: revision.id,
              }
            : {}),
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
      const liveBinding = reviewBindingRef.current;
      if (
        !liveBinding
        || liveBinding.token !== binding.token
        || activeProjectRef.current?.id !== binding.projectId
        || editorHashRef.current !== binding.editorHash
      ) {
        throw new Error("The project changed while the review was running, so the response was not attached or applied.");
      }
      if (includeProjectGraph) {
        const echoed = payload.projectContext;
        if (
          !echoed
          || echoed.projectId !== binding.projectId
          || echoed.snapshotId !== binding.snapshotId
          || echoed.snapshotHash !== binding.snapshotHash
          || echoed.artifactId !== binding.artifactId
          || echoed.artifactRevisionId !== binding.artifactRevisionId
          || echoed.draftHash !== binding.draftHash
        ) {
          throw new Error("The review did not return the exact project and revision binding.");
        }
      }

      let reviewedProject = activeProjectRef.current;
      let completedBinding = binding;
      if (includeProjectGraph && reviewedProject) {
        reviewedProject = addProjectReviewLink(reviewedProject, {
          phase: modeProjectDetails[mode].phase,
          artifactId: binding.artifactId,
          revisionId: binding.artifactRevisionId,
          revisionHash: binding.draftHash,
          requestId: payload.request.id,
          snapshotId: binding.snapshotId,
          snapshotHash: binding.snapshotHash,
          contextHash: stableHash({
            objective,
            lens: reviewLens,
            depth: reviewDepth,
            includeKnowledge,
            includeLogs,
            includeVersions,
          }),
          createdAt: new Date().toISOString(),
        });
        persistProject(reviewedProject);
        const reviewLink = reviewedProject.reviewLinks.find(
          (candidate) => candidate.requestId === payload.request.id,
        );
        completedBinding = { ...binding, reviewLinkId: reviewLink?.id };
      }
      reviewBindingRef.current = completedBinding;
      setReviewBinding(completedBinding);
      setReviewResponse(payload);
      const record: AgentReviewRecord = {
        id: payload.request.id,
        createdAt: new Date().toISOString(),
        projectTitle: title,
        mode,
        instruction: objective,
        response: payload,
      };
      setReviewHistory((current) => [record, ...current].slice(0, REVIEW_HISTORY_LIMIT));
      setStatus(`Review complete · ${payload.source === "openai" ? "AI-assisted review" : "Local rule-based review"}`);
    } catch (error) {
      reviewBindingRef.current = null;
      setReviewBinding(null);
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

  const runConductor = async (depth: "standard" | "deep") => {
    if (!canReview || intelligenceRunning || reviewRunning || !isOnline) return;
    const controller = new AbortController();
    intelligenceControllerRef.current = controller;
    setIntelligenceDepth(depth);
    setIntelligenceRunning(true);
    setIntelligenceError("");
    setIntelligenceResponse(null);
    setIntelligenceBinding(null);
    intelligenceBindingRef.current = null;
    setRightTab("intelligence");
    setMobilePane("intelligence");

    try {
      const readiness = await refreshAiReadiness(controller.signal);
      if (!readiness.deploymentReady && !readiness.localFallbackReady) {
        throw new Error(readiness.blockers[0]?.message ?? "Review configuration is required before any project content can be transmitted.");
      }
      const project = commitDraftToProject(draft, "human");
      if (!project) throw new Error("The current draft could not be saved before the project review.");
      const artifact = artifactForProjectMode(project, mode);
      const revision = artifact
        ? project.revisions.find(({ id }) => id === artifact.activeRevisionId)
        : undefined;
      if (!artifact || !revision) {
        throw new Error("The active artifact revision could not be attached to the project review.");
      }
      const snapshot = buildProjectSnapshot(project, { activeArtifactId: artifact.id });
      const binding: IntelligenceBinding = {
        token: makeId(),
        projectId: project.id,
        snapshotId: snapshot.id,
        snapshotHash: snapshot.hash,
        artifactId: artifact.id,
        artifactRevisionId: revision.id,
        draftHash: revision.contentHash,
        editorHash,
      };
      intelligenceBindingRef.current = binding;
      const objective = (
        project.summary.trim()
        || title.trim()
        || (mode === "code" ? "Advance this working prototype responsibly." : currentText.trim())
      ).slice(0, 600);
      const request = intelligenceRunRequestSchema.parse({
        mode,
        title,
        text: currentText,
        code,
        objective,
        depth,
        projectContext: intelligenceProjectContext(project),
        context: {
          codeLogs: codeLogs.slice(-12),
          versions: versions.slice(0, 3).map((version) => ({
            id: version.id,
            name: version.name,
            mode: version.draft.mode,
            text: version.draft.text.slice(0, 600),
          })),
        },
        orchestration: {
          maxSpecialistPasses: 2,
          requestedRoles: [],
        },
        capabilityNegotiation: {
          requested: [...intelligenceCapabilities],
        },
        projectGraphSnapshot: snapshot,
        artifactRevisionId: revision.id,
      });

      let payload: IntelligenceRunResponse;
      if (intelligenceExecution === "durable") {
        if (!readiness.deploymentReady || !readiness.providerReady) {
          throw new Error("Durable review requires configured provider routing, distributed usage protection, cloud sign-in, and a current cloud project version.");
        }
        const startResponse = await fetch("/api/intelligence/workflows", {
          method: "POST",
          headers: withActiveCloudOrganization({
            "Content-Type": "application/json",
            "Idempotency-Key": `kx.durable.${makeId()}`,
          }),
          signal: controller.signal,
          body: JSON.stringify(request),
        });
        const started = await startResponse.json().catch(() => null) as unknown;
        if (!startResponse.ok || !started || typeof started !== "object") {
          throw new Error(apiErrorMessage(
            started,
            "The durable review could not be started. Confirm cloud sign-in and synchronize this project first.",
          ));
        }
        const runId = (started as { runId?: unknown }).runId;
        const statusUrl = (started as { statusUrl?: unknown }).statusUrl;
        if (typeof runId !== "string" || typeof statusUrl !== "string") {
          throw new Error("The durable review service returned an invalid run reference.");
        }
        durableWorkflowRunRef.current = runId;
        setStatus(`Durable project review queued · ${runId}`);

        let completed: unknown = null;
        for (let attempt = 0; attempt < 96; attempt += 1) {
          await waitForReviewPoll(attempt === 0 ? 250 : 1_250, controller.signal);
          const statusResponse = await fetch(statusUrl, {
            cache: "no-store",
            headers: withActiveCloudOrganization({ Accept: "application/json" }),
            signal: controller.signal,
          });
          const statusBody = await statusResponse.json().catch(() => null) as unknown;
          if (!statusResponse.ok || !statusBody || typeof statusBody !== "object") {
            throw new Error(apiErrorMessage(statusBody, "The durable review status could not be read."));
          }
          const workflowStatus = (statusBody as { status?: unknown }).status;
          if (workflowStatus === "completed") {
            completed = (statusBody as { outcome?: unknown }).outcome;
            break;
          }
          if (workflowStatus === "failed" || workflowStatus === "cancelled") {
            throw new Error(`The durable review ${workflowStatus}. The project remains unchanged.`);
          }
          setStatus(`Durable project review ${typeof workflowStatus === "string" ? workflowStatus : "in progress"} · ${runId}`);
        }
        if (!completed || typeof completed !== "object") {
          throw new Error("The durable review is still running. Its cloud audit record remains available for recovery.");
        }
        if ((completed as { ok?: unknown }).ok !== true) {
          throw new Error(apiErrorMessage(completed, "The durable review did not complete. The project remains unchanged."));
        }
        payload = intelligenceRunResponseSchema.parse(
          (completed as { result?: unknown }).result,
        );
      } else {
        const response = await fetch("/api/intelligence/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(request),
        });
        const raw = await response.json().catch(() => null) as unknown;
        if (!response.ok) {
          throw new Error(apiErrorMessage(raw, "The project review did not complete."));
        }
        payload = intelligenceRunResponseSchema.parse(raw);
      }
      const liveBinding = intelligenceBindingRef.current;
      const liveProject = activeProjectRef.current;
      if (
        !liveBinding
        || liveBinding.token !== binding.token
        || liveProject?.id !== binding.projectId
        || editorHashRef.current !== binding.editorHash
      ) {
        throw new Error("The project changed during the review, so the result was not attached.");
      }
      const echoed = payload.projectContext;
      if (
        echoed.projectId !== binding.projectId
        || echoed.snapshotId !== binding.snapshotId
        || echoed.snapshotHash !== binding.snapshotHash
        || echoed.artifactId !== binding.artifactId
        || echoed.artifactRevisionId !== binding.artifactRevisionId
        || echoed.draftHash !== binding.draftHash
      ) {
        throw new Error("The project review did not return the expected Atlas snapshot and revision.");
      }

      const reviewedProject = addProjectReviewLink(liveProject, {
        phase: artifact.phase,
        artifactId: artifact.id,
        revisionId: revision.id,
        revisionHash: revision.contentHash,
        requestId: payload.runId,
        snapshotId: snapshot.id,
        snapshotHash: snapshot.hash,
        contextHash: stableHash({
          objective,
          depth,
          requestedCapabilities: intelligenceCapabilities,
          protocolVersion: payload.protocolVersion,
        }),
        createdAt: payload.completedAt,
      });
      persistProject(reviewedProject);
      const reviewLink = reviewedProject.reviewLinks.find(
        ({ requestId }) => requestId === payload.runId,
      );
      const completedBinding: IntelligenceBinding = {
        ...binding,
        runId: payload.runId,
        reviewLinkId: reviewLink?.id,
        projectUpdatedAt: reviewedProject.updatedAt,
      };
      intelligenceBindingRef.current = completedBinding;
      setIntelligenceBinding(completedBinding);
      setIntelligenceResponse(payload);
      setStatus(
        `Project review complete · ${payload.orchestration.passes.length} specialist reviews · ${payload.source === "openai" ? "AI-assisted review" : "Local rule-based review"}`,
      );
    } catch (error) {
      intelligenceBindingRef.current = null;
      setIntelligenceBinding(null);
      if (error instanceof DOMException && error.name === "AbortError") {
        setIntelligenceError("Project review stopped. The project and current input are unchanged.");
      } else {
        setIntelligenceError(
          error instanceof Error
            ? error.message
            : "The project review did not complete. The project remains unchanged.",
        );
      }
    } finally {
      setIntelligenceRunning(false);
      intelligenceControllerRef.current = null;
      durableWorkflowRunRef.current = null;
    }
  };

  const stopConductor = () => {
    const workflowRunId = durableWorkflowRunRef.current;
    intelligenceControllerRef.current?.abort();
    if (workflowRunId) {
      void fetch(`/api/intelligence/workflows?runId=${encodeURIComponent(workflowRunId)}`, {
        method: "DELETE",
        headers: withActiveCloudOrganization({ Accept: "application/json" }),
      }).catch(() => undefined);
      setStatus(`Durable review cancellation requested · ${workflowRunId}`);
    }
  };

  const addManualEvidence = async (submission: ManualEvidenceSubmission) => {
    if (!activeProject || projectMutationLocked) {
      throw new Error("The project is currently locked by an active review.");
    }
    try {
      const recordedAt = new Date().toISOString();
      const body = [
        submission.statement,
        submission.sourceRef ? `Source: ${submission.sourceRef}` : "Source: not recorded",
      ].join("\n\n");
      let next = appendArtifactRevision(activeProject, {
        kind: "evidence",
        title: submission.title,
        phase: submission.phase,
        body: textRevisionBody(body),
        source: "human",
        createdAt: recordedAt,
      });
      const evidenceArtifact = next.artifacts.find(
        (artifact) => artifact.kind === "evidence" && artifact.createdAt === recordedAt,
      );
      next = upsertProjectNode(next, {
        key: `manual-evidence:${evidenceArtifact?.id ?? recordedAt}`,
        kind: "evidence",
        phase: submission.phase,
        label: submission.title,
        statement: submission.statement,
        status: submission.status,
        sourceRef: submission.sourceRef,
        recordedAt,
      });
      persistProject(next);
      setIntelligenceBinding(null);
      intelligenceBindingRef.current = null;
      setStatus(`Evidence added to ${submission.phase} · human-authored`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Evidence could not be recorded.");
      throw error;
    }
  };

  const addGovernedEvidence = async (evidence: GovernedEvidence) => {
    if (!activeProject || projectMutationLocked) {
      throw new Error("The project is currently locked by an active review.");
    }
    try {
      const next = addGovernedEvidenceToProject(activeProject, evidence);
      persistProject(next);
      setIntelligenceBinding(null);
      intelligenceBindingRef.current = null;
      setReviewBinding(null);
      reviewBindingRef.current = null;
      setStatus(`Evidence recorded in ${evidence.phase} · ${evidence.provenance.captureMethod} · no network intake`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Evidence could not be recorded.");
      throw error;
    }
  };

  const acceptConductorRevision = (response: IntelligenceRunResponse) => {
    if (
      intelligenceAccepting
      || !activeProject
      || !intelligenceBinding
      || !intelligenceBindingIsCurrent
      || response.runId !== intelligenceBinding.runId
    ) {
      setIntelligenceError("This synthesis is no longer bound to the current Atlas revision. Run Conductor again.");
      return;
    }
    setIntelligenceAccepting(true);
    try {
      saveVersion("agent", `${title || "Untitled"} · before Conductor change`);
      const proposedDraft: WorkspaceDraft = mode === "code"
        ? {
            ...draft,
            code: response.review.improvedCode ?? { ...code, html: response.review.improvedInput },
          }
        : { ...draft, text: response.review.improvedInput };
      // Acceptance is a governance event, not only a content mutation. Record
      // an immutable accepted revision even when a bounded local synthesis
      // deliberately preserves the exact reviewed bytes.
      const acceptedProject = appendDeliberatelyAcceptedDraft(
        activeProject,
        proposedDraft,
      );
      persistProject(acceptedProject);
      if (mode === "code") {
        const proposedCode = response.review.improvedCode
          ?? { ...code, html: response.review.improvedInput };
        setCode(proposedCode);
        setCommittedCode(proposedCode);
        setRunId((value) => value + 1);
      } else {
        setTextByMode((current) => ({
          ...current,
          [mode]: response.review.improvedInput,
        }));
      }
      setIntelligenceBinding(null);
      intelligenceBindingRef.current = null;
      setRightTab("preview");
      setMobilePane("preview");
      setStatus("Project review proposal saved as a new project revision");
    } catch (error) {
      setIntelligenceError(
        error instanceof Error ? error.message : "The project review proposal could not be accepted.",
      );
    } finally {
      setIntelligenceAccepting(false);
    }
  };

  const applyAgentVersion = () => {
    const review = reviewResponse?.review;
    const binding = reviewBinding;
    const project = activeProject;
    if (!review || !binding || !project) return;
    const artifact = project.artifacts.find(({ id }) => id === binding.artifactId);
    if (
      project.id !== binding.projectId
      || editorHash !== binding.editorHash
      || !artifact
      || artifact.activeRevisionId !== binding.artifactRevisionId
    ) {
      setReviewError("This proposal belongs to an earlier project revision. Run a new review before applying it.");
      return;
    }
    saveVersion("agent", `${title || "Untitled"} · before Agent change`);
    const proposedDraft: WorkspaceDraft = mode === "code"
      ? {
          ...draft,
          code: review.proposedCode ?? { ...code, html: review.improvedInput },
        }
      : { ...draft, text: review.improvedInput };
    const acceptedProject = appendDraftToProject(project, proposedDraft, "agent-accepted");
    persistProject(acceptedProject);
    if (mode === "code") {
      const proposedCode = review.proposedCode ?? { ...code, html: review.improvedInput };
      setCode(proposedCode);
      setCommittedCode(proposedCode);
      setRunId((value) => value + 1);
    } else {
      setTextByMode((current) => ({ ...current, [mode]: review.improvedInput }));
    }
    setRightTab("preview");
    setMobilePane("preview");
    setReviewBinding(null);
    reviewBindingRef.current = null;
    setStatus("Review proposal applied as a new version");
  };

  const openHandoff = () => handoffRef.current?.showModal();

  const continueToContact = () => {
    const selectedReview = intelligenceResponse?.review ?? reviewResponse?.review ?? null;
    const packageValue = {
      generatedAt: new Date().toISOString(),
      current: draft,
      agentReview: handoffAgent ? selectedReview : null,
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

  const atlasPhaseState = useMemo(() => {
    if (!activeProject) return {};
    return Object.fromEntries(
      (["discovery", "evidence", "systems", "prototype", "validation", "delivery"] as const)
        .map((phase) => {
          const gate = activeProject.gates.find((candidate) => candidate.phase === phase);
          const phaseArtifacts = activeProject.artifacts.filter((artifact) => artifact.phase === phase);
          const phaseEvidence = phaseArtifacts.filter((artifact) => artifact.kind === "evidence");
          const known = activeProject.nodes.filter(
            (node) => node.phase === phase && ["known", "validated"].includes(node.status),
          ).length;
          const unresolved = activeProject.nodes.filter(
            (node) => node.phase === phase && ["unresolved", "testing", "blocked"].includes(node.status),
          ).length;
          const status = gate?.status === "approved"
            ? "complete"
            : phaseArtifacts.length > 0 && phaseEvidence.length > 0
              ? "review"
              : activeProject.activePhase === phase
                ? "active"
                : "not-started";
          return [phase, { status, known, unresolved }] as const;
        }),
    );
  }, [activeProject]);

  const atlasLineage = useMemo(() => {
    if (!activeProject) return [];
    return [...activeProject.revisions]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 6)
      .map((revision) => ({
        id: revision.id,
        label: activeProject.artifacts.find(({ id }) => id === revision.artifactId)?.title
          ?? "Project artifact",
        source: revision.source,
        revision: revision.id.slice(-8),
      }));
  }, [activeProject]);

  const selectAtlasPhase = (phase: PlatformPhaseId) => {
    if (!activeProject || projectMutationLocked) return;
    try {
      const next = parseKingxfordProject({
        ...activeProject,
        activePhase: phase,
        updatedAt: new Date().toISOString(),
      });
      persistProject(next);
      const matchingMode = workspaceModes.find(
        (candidate) => modeProjectDetails[candidate].phase === phase,
      );
      if (matchingMode) switchMode(matchingMode);
      setStatus(`${phase[0].toLocaleUpperCase("en") + phase.slice(1)} phase selected`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The phase could not be selected.");
    }
  };

  const askPhaseSpecialist = (phase: PlatformPhaseId) => {
    setReviewLens(phase);
    setReviewInstruction(`Review the current project revision from the ${phase} perspective. Identify the most important unresolved issue and propose one evidence-based next step.`);
    setRightTab("agent");
    setMobilePane("agent");
    setStatus(`${phase[0].toLocaleUpperCase("en") + phase.slice(1)} specialist ready`);
  };

  const approveAtlasGate = (phase: PlatformPhaseId) => {
    if (!activeProject || projectMutationLocked) return;
    const workflowReadiness = workflowPhaseReadiness(activeProject, phase);
    if (workflowReadiness && !workflowReadiness.evidenceThresholdMet) {
      setStatus(
        `${workflowReadiness.gateTitle} requires ${workflowReadiness.minimumEvidence} evidence items; ${workflowReadiness.evidenceCount} recorded`,
      );
      return;
    }
    const evidenceArtifactIds = activeProject.artifacts
      .filter((artifact) => artifact.phase === phase && artifact.kind === "evidence")
      .map(({ id }) => id);
    if (evidenceArtifactIds.length === 0) {
      setStatus(`Approval requires evidence for the ${phase} phase`);
      return;
    }
    const rationale = window.prompt(
      `Explain why the ${phase} phase should be approved. Only you can record this approval; AI output cannot do so.`,
    )?.trim();
    if (!rationale) {
      setStatus("Approval was not recorded because a rationale is required.");
      return;
    }
    try {
      const next = recordHumanGateDecision(activeProject, {
        phase,
        outcome: "approved",
        rationale,
        evidenceArtifactIds,
        actorId: "local-project-owner",
      });
      persistProject(next);
      setStatus(`${phase[0].toLocaleUpperCase("en") + phase.slice(1)} approval recorded`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The approval decision was not recorded.");
    }
  };

  const shellStyle = { "--workspace-left": `${paneWidth}%` } as CSSProperties;

  const WorkspaceRoot = embedded ? "section" : "main";
  const CanvasHeading = embedded ? "h3" : "h1";

  return (
    <WorkspaceRoot
      className={styles.workspacePage}
      data-embedded={embedded ? "true" : "false"}
      data-mobile-pane={mobilePane}
    >
      <section className={styles.intro} aria-labelledby="canvas-title">
        <div>
          <p>Kingxford Canvas · Project workspace</p>
          <CanvasHeading id="canvas-title">Develop an idea into a testable prototype.</CanvasHeading>
        </div>
        <p>
          Develop an idea, run front-end code, map a system, test a prompt, or
          shape an implementation brief, with the input and preview in view together.
        </p>
      </section>

      <section className={styles.projectManager} aria-label="Local project library">
        <div>
          <span>Project library</span>
          <strong>{projectRepository.projects.length} / {PROJECT_REPOSITORY_MAX_PROJECTS} projects on this device</strong>
          <small>Stored on this device · imported project files are validated before opening</small>
        </div>
        <label>
          <span>Current project</span>
          <select
            value={activeProject?.id ?? ""}
            disabled={projectMutationLocked}
            onChange={(event) => switchProject(event.target.value)}
          >
            {projectRepository.projects.map((project) => (
              <option value={project.id} key={project.id}>{project.title}</option>
            ))}
          </select>
        </label>
        <div className={styles.projectManagerActions}>
          <button
            type="button"
            disabled={projectMutationLocked || projectRepository.projects.length >= PROJECT_REPOSITORY_MAX_PROJECTS}
            onClick={createLocalProject}
          >
            <Plus aria-hidden="true" /> New project
          </button>
          <button type="button" disabled={!activeProject || projectMutationLocked} onClick={() => exportProjectPackage()}>
            <Download aria-hidden="true" /> Export project
          </button>
          <button
            type="button"
            disabled={projectMutationLocked || projectRepository.projects.length >= PROJECT_REPOSITORY_MAX_PROJECTS}
            onClick={() => importRef.current?.click()}
          >
            <Upload aria-hidden="true" /> Import
          </button>
          <button
            type="button"
            disabled={projectMutationLocked || projectRepository.projects.length < 2}
            onClick={deleteCurrentProject}
          >
            <Trash2 aria-hidden="true" /> Delete
          </button>
          <button
            type="button"
            disabled={projectMutationLocked}
            onClick={() => setProjectLibraryOpen(true)}
          >
            <FolderKanban aria-hidden="true" /> Library
          </button>
          <input
            ref={importRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label="Import a Kingxford project package"
            onChange={(event) => void importProjectPackage(event.target.files?.[0])}
          />
        </div>
      </section>

      {!embedded && hydrated ? (
        <CloudProjectPanel
          className={styles.cloudProjects}
          currentProject={activeProject}
          projects={projectRepository.projects}
          onReceiveCloudProject={receiveCloudProject}
        />
      ) : null}

      <WorkflowLibrary
        disabled={projectMutationLocked || projectRepository.projects.length >= PROJECT_REPOSITORY_MAX_PROJECTS}
        currentTemplateId={activeWorkflowTemplate?.id ?? null}
        headingLevel={embedded ? "h3" : "h2"}
        onStart={startWorkflow}
      />

      {activeProject ? (
        <EvidenceIntake
          key={activeProject.id}
          project={activeProject}
          disabled={projectMutationLocked}
          headingLevel={embedded ? "h3" : "h2"}
          onAdd={addGovernedEvidence}
        />
      ) : null}

      {!embedded && activeProject ? (
        <CloudEvidencePanel
          key={`cloud-evidence:${activeProject.id}`}
          project={activeProject}
          disabled={projectMutationLocked}
        />
      ) : null}

      <div className={styles.atlasShell}>
        <ProjectContinuum
          activePhase={activeProject?.activePhase}
          phaseState={atlasPhaseState}
          knownCount={activeProject?.nodes.filter(
            (node) => ["known", "validated"].includes(node.status),
          ).length}
          unresolvedCount={activeProject?.nodes.filter(
            (node) => ["unresolved", "testing", "blocked"].includes(node.status),
          ).length}
          lineage={atlasLineage}
          artifactLabel={activeArtifact
            ? `${activeArtifact.title} · ${activeArtifact.activeRevisionId.slice(-8)}`
            : "No artifact revision selected"}
          onPhaseChange={selectAtlasPhase}
          onAskSpecialist={askPhaseSpecialist}
          onAdvanceGate={approveAtlasGate}
        />
      </div>

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
          <small
            className={styles.aiReadiness}
            data-state={reviewAvailability.state}
            title={reviewAvailability.detail}
          >
            {reviewAvailability.label}
          </small>
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
            ["intelligence", BrainCircuit, "Conductor"],
            ["agent", Bot, "Agent"],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            type="button"
            aria-pressed={mobilePane === value}
            onClick={() => {
              setMobilePane(value);
              if (value === "preview") setRightTab("preview");
              if (value === "intelligence") setRightTab("intelligence");
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
        <section className={styles.workbench} aria-label="Project input editor">
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
                  onKeyDown={handleRovingTabKey}
                  key={value}
                >
                  <Icon aria-hidden="true" />
                  <span>{modeDetails[value].shortLabel}</span>
                </button>
              );
            })}
          </nav>

          <div id="workspace-editor" className={styles.editorPane} role="tabpanel" aria-labelledby={`workspace-mode-${mode}`}>
            <header className={styles.editorHeading}>
              <div>
                <span>{modeDetails[mode].label} editor</span>
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
                      id={`workspace-code-tab-${value}`}
                      aria-selected={codeFile === value}
                      aria-controls="workspace-code-editor"
                      tabIndex={codeFile === value ? 0 : -1}
                      onClick={() => setCodeFile(value)}
                      onKeyDown={handleRovingTabKey}
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
                  role="tabpanel"
                  aria-labelledby={`workspace-code-tab-${codeFile}`}
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
                <span>Stored locally</span>
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
          aria-label="Resize editor and result panes"
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

        <section className={styles.resultPane} aria-label="Preview, project review, and version history">
          <nav className={styles.resultTabs} role="tablist" aria-label="Result views">
            {(
              [
                ["preview", PanelRight, "Live preview"],
                ["intelligence", BrainCircuit, "Conductor"],
                ["agent", Bot, "Agent review"],
                ["versions", History, `Versions ${versions.length}`],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                type="button"
                role="tab"
                id={`workspace-result-tab-${value}`}
                aria-selected={rightTab === value}
                aria-controls={`workspace-${value}-panel`}
                tabIndex={rightTab === value ? 0 : -1}
                onClick={() => setRightTab(value)}
                onKeyDown={handleRovingTabKey}
                key={value}
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
            <span
              className={styles.localBadge}
              title="The editable source and project repository remain on this device. Checked context is sent only when you deliberately start a review or Conductor run."
            >
              <span /> Stored locally
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
            id="workspace-intelligence-panel"
            className={styles.resultView}
            role="tabpanel"
            aria-labelledby="workspace-result-tab-intelligence"
            hidden={rightTab !== "intelligence"}
          >
            {activeProject ? (
              <ProjectIntelligencePanel
                project={activeProject}
                response={intelligenceResponse}
                depth={intelligenceDepth}
                executionMode={intelligenceExecution}
                running={intelligenceRunning}
                bindingIsCurrent={intelligenceBindingIsCurrent}
                accepting={intelligenceAccepting}
                runDisabled={!canReview || !isOnline || !reviewAvailability.ready || reviewRunning}
                statusMessage={`${reviewAvailability.label}. ${reviewAvailability.detail}`}
                errorMessage={intelligenceError}
                onDepthChange={setIntelligenceDepth}
                onExecutionModeChange={setIntelligenceExecution}
                onRun={runConductor}
                onStop={stopConductor}
                onAddEvidence={addManualEvidence}
                onAcceptAsRevision={acceptConductorRevision}
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
              isRunning={reviewRunning}
              error={reviewError}
              instruction={reviewInstruction}
              depth={reviewDepth}
              lens={reviewLens}
              canReview={canReview && isOnline && reviewAvailability.ready}
              includeLogs={includeLogs}
              includeVersions={includeVersions}
              includeKnowledge={includeKnowledge}
              includeProjectGraph={includeProjectGraph}
              reviewHistory={reviewHistory}
              onInstruction={setReviewInstruction}
              onDepth={setReviewDepth}
              onLens={setReviewLens}
              onIncludeLogs={setIncludeLogs}
              onIncludeVersions={setIncludeVersions}
              onIncludeKnowledge={setIncludeKnowledge}
              onIncludeProjectGraph={setIncludeProjectGraph}
              onReview={requestReview}
              onStop={() => controllerRef.current?.abort()}
              onApply={applyAgentVersion}
              canApply={Boolean(reviewBinding)}
              onOpenHistory={(record) => {
                setReviewResponse(record.response);
                setReviewInstruction(record.instruction);
                setReviewLens(record.response.agent.id);
                setReviewError("");
                setStatus(`Opened local review · ${formatTime(record.createdAt)}`);
              }}
              onClearHistory={() => {
                setReviewHistory([]);
                setStatus("Review history cleared");
              }}
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
          disabled={!canReview || projectMutationLocked || !isOnline || !reviewAvailability.ready}
          onClick={() => {
            setRightTab("intelligence");
            setMobilePane("intelligence");
          }}
        >
          <BrainCircuit aria-hidden="true" />
          Conductor
        </button>
        <button
          type="button"
          disabled={!canReview || projectMutationLocked || !isOnline || !reviewAvailability.ready}
          onClick={() => requestReview()}
        >
          <Sparkles aria-hidden="true" />
          Review
        </button>
      </div>

      <section className={styles.handoffStrip}>
        <div>
          <span>Implementation planning</span>
          <h2>Turn the current project into an implementation plan.</h2>
        </div>
        <p>
          Your current project provides context for an initial scope review.
          Kingxford will confirm requirements before proposing a plan and estimate.
        </p>
        <button type="button" onClick={openHandoff}>
          Prepare an implementation request
          <ArrowRight aria-hidden="true" />
        </button>
      </section>

      <ProjectLibraryDialog
        open={projectLibraryOpen}
        projects={projectRepository.projects}
        activeProjectId={activeProject?.id ?? null}
        onClose={() => setProjectLibraryOpen(false)}
        onCreate={() => {
          createLocalProject();
          setProjectLibraryOpen(false);
        }}
        onSelect={(projectId) => {
          switchProject(projectId);
          setProjectLibraryOpen(false);
        }}
        onDuplicate={duplicateLocalProject}
        onImport={(file) => void importProjectPackage(file)}
        onExport={exportProjectPackage}
        onDelete={deleteLibraryProject}
      />

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
              <span>Implementation request</span>
              <h2 id="handoff-title">Request an implementation plan for this project.</h2>
            </div>
            <button type="button" aria-label="Close build request" onClick={() => handoffRef.current?.close()}>
              <X aria-hidden="true" />
            </button>
          </header>
          <p>
            Choose the context to include in your project brief. Nothing is
            submitted until you contact Kingxford.
          </p>
          <div className={styles.handoffOptions}>
            <label><input type="checkbox" checked readOnly /> Current version</label>
            <label>
              <input
                type="checkbox"
                checked={handoffAgent && Boolean(intelligenceResponse || reviewResponse)}
                disabled={!intelligenceResponse && !reviewResponse}
                onChange={(event) => setHandoffAgent(event.target.checked)}
              />
              Latest project review
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
            <small>{sourceLength.toLocaleString()} characters in current draft · {versions.length} saved versions</small>
          </div>
          <button className={styles.handoffPrimary} type="button" onClick={continueToContact}>
            Request a scoped build plan
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </dialog>
    </WorkspaceRoot>
  );
}
