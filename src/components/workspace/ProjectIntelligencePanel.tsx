"use client";

import {
  Activity,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  CircleStop,
  Clock3,
  Database,
  FileCheck2,
  GitBranch,
  GitCommitHorizontal,
  Layers3,
  ListChecks,
  Orbit,
  Play,
  Plus,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  useId,
  useMemo,
  useState,
} from "react";

import { PLATFORM_LIFECYCLE } from "@/lib/platform/registry";
import type {
  IntelligenceRunRequest,
  IntelligenceRunResponse,
} from "@/lib/intelligence/contracts";
import type {
  KingxfordProject,
  ProjectNodeStatus,
  ProjectPhase,
} from "@/lib/workspace/project-graph";

import styles from "./ProjectIntelligencePanel.module.css";

const tabs = ["project", "conductor", "provenance"] as const;
type IntelligenceTab = (typeof tabs)[number];
type IntelligenceDepth = IntelligenceRunRequest["depth"];

export type ManualEvidenceSubmission = Readonly<{
  title: string;
  statement: string;
  sourceRef: string | null;
  status: Extract<ProjectNodeStatus, "known" | "unresolved">;
  phase: ProjectPhase;
}>;

export type ProjectIntelligencePanelProps = Readonly<{
  project: KingxfordProject;
  response: IntelligenceRunResponse | null;
  depth: IntelligenceDepth;
  running: boolean;
  bindingIsCurrent: boolean;
  onDepthChange: (depth: IntelligenceDepth) => void;
  onRun: (depth: IntelligenceDepth) => void;
  onStop: () => void;
  onAddEvidence: (
    evidence: ManualEvidenceSubmission,
  ) => void | Promise<void>;
  onAcceptAsRevision: (response: IntelligenceRunResponse) => void;
  accepting?: boolean;
  runDisabled?: boolean;
  statusMessage?: string;
  errorMessage?: string;
}>;

type Metric = Readonly<{
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "known" | "unresolved";
}>;

const numberFormatter = new Intl.NumberFormat("en", { notation: "compact" });
const dateTimeFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function formatLatency(milliseconds: number) {
  if (milliseconds < 1_000) return `${milliseconds} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : dateTimeFormatter.format(date);
}

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toLocaleUpperCase("en") + part.slice(1))
    .join(" ");
}

function phaseDefinition(phase: ProjectPhase) {
  return PLATFORM_LIFECYCLE.find((item) => item.id === phase) ?? PLATFORM_LIFECYCLE[0];
}

function handleTabKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  current: IntelligenceTab,
  setTab: (tab: IntelligenceTab) => void,
  tabId: (tab: IntelligenceTab) => string,
) {
  const currentIndex = tabs.indexOf(current);
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = tabs.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  const next = tabs[nextIndex];
  setTab(next);
  requestAnimationFrame(() => document.getElementById(tabId(next))?.focus());
}

function ReviewList({
  title,
  items,
}: Readonly<{ title: string; items: readonly string[] }>) {
  if (!items.length) return null;
  return (
    <section className={styles.reviewList}>
      <h5>{title}</h5>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function ProjectIntelligencePanel({
  project,
  response,
  depth,
  running,
  bindingIsCurrent,
  onDepthChange,
  onRun,
  onStop,
  onAddEvidence,
  onAcceptAsRevision,
  accepting = false,
  runDisabled = false,
  statusMessage = "",
  errorMessage = "",
}: ProjectIntelligencePanelProps) {
  const instanceId = useId();
  const [tab, setTab] = useState<IntelligenceTab>("project");
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [evidenceNotice, setEvidenceNotice] = useState("");
  const phase = phaseDefinition(project.activePhase);

  const metrics = useMemo<readonly Metric[]>(() => {
    const evidence = project.nodes.filter((node) => node.kind === "evidence").length;
    const known = project.nodes.filter((node) => node.status === "known").length;
    const unresolved = project.nodes.filter((node) => node.status === "unresolved").length;
    return [
      { label: "Evidence", value: evidence, icon: BookOpenCheck },
      { label: "Known", value: known, icon: CheckCircle2, tone: "known" },
      { label: "Unresolved", value: unresolved, icon: TriangleAlert, tone: "unresolved" },
      { label: "Decisions", value: project.decisions.length, icon: ListChecks },
      { label: "Revisions", value: project.revisions.length, icon: GitCommitHorizontal },
      { label: "Reviews", value: project.reviewLinks.length, icon: Activity },
    ];
  }, [project]);

  const evidenceNodes = useMemo(
    () =>
      project.nodes
        .filter((node) => node.kind === "evidence")
        .slice(-6)
        .reverse(),
    [project.nodes],
  );

  const providerCalls = response?.provenance.providerCalls ?? [];
  const totalLatency = providerCalls.reduce((sum, call) => sum + call.latencyMs, 0);
  const acceptDisabled = !response || running || accepting || !bindingIsCurrent;
  const tabId = (value: IntelligenceTab) => `${instanceId}-tab-${value}`;
  const panelId = (value: IntelligenceTab) => `${instanceId}-panel-${value}`;

  const submitEvidence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (evidenceSubmitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const statement = String(data.get("statement") ?? "").trim();
    const sourceRef = String(data.get("sourceRef") ?? "").trim();
    const status = data.get("status") === "unresolved" ? "unresolved" : "known";

    if (!title || !statement) {
      setEvidenceNotice("Name the evidence and state exactly what it establishes or leaves unresolved.");
      return;
    }

    setEvidenceSubmitting(true);
    setEvidenceNotice("");
    try {
      await onAddEvidence({
        title: title.slice(0, 180),
        statement: statement.slice(0, 1_200),
        sourceRef: sourceRef ? sourceRef.slice(0, 320) : null,
        status,
        phase: project.activePhase,
      });
      form.reset();
      setEvidenceNotice("Evidence handed to the project graph for validation and storage.");
    } catch {
      setEvidenceNotice("The evidence was not added. The project graph remains unchanged.");
    } finally {
      setEvidenceSubmitting(false);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby={`${instanceId}-heading`}>
      <header className={styles.heading}>
        <div>
          <span><Orbit aria-hidden="true" /> Project intelligence · Conductor</span>
          <h2 id={`${instanceId}-heading`}>{project.title}</h2>
          <p>{phase.label} · {phase.outcome}</p>
        </div>
        <div className={styles.phaseBadge} aria-label={`Current phase: ${phase.label}`}>
          <small>{phase.index}</small>
          <strong>{phase.label}</strong>
          <span>{phase.action}</span>
        </div>
      </header>

      <section className={styles.objective} aria-labelledby={`${instanceId}-objective`}>
        <div>
          <Radar aria-hidden="true" />
          <span>Canonical objective</span>
        </div>
        <p id={`${instanceId}-objective`}>
          {project.summary.trim() || "No objective has been committed to this project graph yet."}
        </p>
      </section>

      <section className={styles.controlDeck} aria-labelledby={`${instanceId}-conductor-control`}>
        <div className={styles.controlCopy}>
          <span><BrainCircuit aria-hidden="true" /> Governed orchestration</span>
          <h3 id={`${instanceId}-conductor-control`}>Direct one evidence-bound Conductor run.</h3>
          <p>Plan, specialist passes, synthesis, provenance, and acceptance remain one reviewable operation.</p>
        </div>
        <fieldset className={styles.depthControl} disabled={running}>
          <legend>Reasoning depth</legend>
          {(["standard", "deep"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name={`${instanceId}-depth`}
                value={value}
                checked={depth === value}
                onChange={() => onDepthChange(value)}
              />
              <span>
                <strong>{titleCase(value)}</strong>
                <small>{value === "deep" ? "Extended orchestration" : "Focused orchestration"}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {running ? (
          <button className={styles.stopButton} type="button" onClick={onStop}>
            <CircleStop aria-hidden="true" /> Stop run
          </button>
        ) : (
          <button
            className={styles.runButton}
            type="button"
            disabled={runDisabled}
            onClick={() => onRun(depth)}
          >
            <Play aria-hidden="true" /> Run Conductor
          </button>
        )}
        <div className={styles.runState} data-running={running ? "true" : "false"} aria-live="polite">
          <i aria-hidden="true" />
          <span>{running ? "Conductor is coordinating the bounded run…" : statusMessage || "Ready for a bound project review."}</span>
        </div>
      </section>

      {errorMessage ? (
        <p className={styles.errorNotice} role="alert">
          <ShieldAlert aria-hidden="true" /> {errorMessage}
        </p>
      ) : null}

      <nav className={styles.tabs} role="tablist" aria-label="Project intelligence views">
        {tabs.map((value) => (
          <button
            id={tabId(value)}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={panelId(value)}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => handleTabKeyDown(event, tab, setTab, tabId)}
            key={value}
          >
            {value === "project" ? "Project graph" : titleCase(value)}
            {value === "conductor" && response ? <span>1</span> : null}
            {value === "provenance" && providerCalls.length ? <span>{providerCalls.length}</span> : null}
          </button>
        ))}
      </nav>

      <div
        id={panelId("project")}
        className={styles.view}
        role="tabpanel"
        aria-labelledby={tabId("project")}
        hidden={tab !== "project"}
      >
        <div className={styles.metrics} aria-label="Project graph metrics">
          {metrics.map(({ label, value, icon: Icon, tone }) => (
            <article data-tone={tone} key={label}>
              <Icon aria-hidden="true" />
              <strong>{formatNumber(value)}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>

        <section className={styles.lifecycle} aria-labelledby={`${instanceId}-lifecycle`}>
          <header>
            <span><Waypoints aria-hidden="true" /> Lifecycle position</span>
            <strong id={`${instanceId}-lifecycle`}>{phase.description}</strong>
          </header>
          <ol>
            {PLATFORM_LIFECYCLE.map((item) => (
              <li data-current={item.id === project.activePhase ? "true" : "false"} key={item.id}>
                <span>{item.index}</span>
                <small>{item.label}</small>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.evidenceWorkspace} aria-labelledby={`${instanceId}-evidence-heading`}>
          <form className={styles.evidenceForm} onSubmit={submitEvidence}>
            <header>
              <div>
                <span><Plus aria-hidden="true" /> Manual evidence</span>
                <h3 id={`${instanceId}-evidence-heading`}>Add an inspectable claim to the graph.</h3>
              </div>
              <p>The caller validates and persists this submission; this panel never writes storage.</p>
            </header>
            <div className={styles.formGrid}>
              <label>
                <span>Evidence title</span>
                <input name="title" maxLength={180} required placeholder="Short, specific reference" />
              </label>
              <label>
                <span>Confidence state</span>
                <select name="status" defaultValue="known">
                  <option value="known">Known from supplied evidence</option>
                  <option value="unresolved">Unresolved — requires verification</option>
                </select>
              </label>
            </div>
            <label>
              <span>What does it establish?</span>
              <textarea name="statement" rows={4} maxLength={1_200} required placeholder="Separate the observable claim from interpretation or uncertainty." />
            </label>
            <label>
              <span>Source reference</span>
              <input name="sourceRef" maxLength={320} placeholder="URL, dataset, document, interview, or workspace artifact" />
            </label>
            <button type="submit" disabled={evidenceSubmitting}>
              <Plus aria-hidden="true" /> {evidenceSubmitting ? "Adding…" : "Add evidence"}
            </button>
            <p className={styles.formNotice} aria-live="polite">{evidenceNotice}</p>
          </form>

          <section className={styles.evidenceLedger} aria-label="Recent evidence nodes">
            <header>
              <span><Database aria-hidden="true" /> Evidence ledger</span>
              <strong>{evidenceNodes.length ? `${evidenceNodes.length} recent` : "Awaiting evidence"}</strong>
            </header>
            {evidenceNodes.length ? (
              <ol>
                {evidenceNodes.map((node) => (
                  <li data-status={node.status} key={node.id}>
                    <div>
                      <span>{titleCase(node.status)}</span>
                      <small>{phaseDefinition(node.phase).label}</small>
                    </div>
                    <h4>{node.label}</h4>
                    <p>{node.statement || "No annotation was recorded."}</p>
                    {node.sourceRef ? <code>{node.sourceRef}</code> : <em>Source not recorded</em>}
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.emptyState}>
                <BookOpenCheck aria-hidden="true" />
                <p>Add the first source, observation, or unresolved claim for this phase.</p>
              </div>
            )}
          </section>
        </section>
      </div>

      <div
        id={panelId("conductor")}
        className={styles.view}
        role="tabpanel"
        aria-labelledby={tabId("conductor")}
        hidden={tab !== "conductor"}
      >
        {response ? (
          <div className={styles.runResult}>
            <header className={styles.resultHeader}>
              <div>
                <span><Sparkles aria-hidden="true" /> Typed phase plan</span>
                <h3>{phaseDefinition(response.orchestration.plan.phase).label} · {response.orchestration.plan.summary}</h3>
              </div>
              <span data-status={response.status}>{titleCase(response.status)}</span>
            </header>

            {response.notice ? (
              <p className={styles.responseNotice}>
                <ShieldCheck aria-hidden="true" /> {response.notice}
              </p>
            ) : null}

            <section className={styles.plan}>
              <div className={styles.planObjective}>
                <small>Phase objective</small>
                <p>{response.orchestration.plan.phaseObjective}</p>
              </div>
              <div className={styles.planColumns}>
                <section>
                  <h4>Sequence</h4>
                  <ol>
                    {response.orchestration.plan.sequence.map((item, index) => (
                      <li key={`sequence-${index}`}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>
                    ))}
                  </ol>
                </section>
                <section>
                  <h4>Acceptance criteria</h4>
                  <ul>
                    {response.orchestration.plan.acceptanceCriteria.map((item, index) => (
                      <li key={`criterion-${index}`}><CheckCircle2 aria-hidden="true" />{item}</li>
                    ))}
                  </ul>
                </section>
              </div>
              <div className={styles.planAssignments}>
                {response.orchestration.plan.specialists.map((specialist) => (
                  <article key={specialist.role}>
                    <span>{titleCase(specialist.role)} specialist</span>
                    <strong>{specialist.mandate}</strong>
                    <p>{specialist.expectedContribution}</p>
                  </article>
                ))}
              </div>
              {response.orchestration.plan.conflicts.length ? (
                <div className={styles.planWarnings}>
                  <TriangleAlert aria-hidden="true" />
                  <div><strong>Conflicts retained</strong><p>{response.orchestration.plan.conflicts.join(" · ")}</p></div>
                </div>
              ) : null}
              <details className={styles.planBoundaries}>
                <summary>Governance boundaries</summary>
                <ul>
                  {response.orchestration.plan.boundaries.map((boundary, index) => (
                    <li key={`boundary-${index}`}>{boundary}</li>
                  ))}
                </ul>
              </details>
              <footer><span>Governed handoff</span><p>{response.orchestration.plan.handoff}</p></footer>
            </section>

            <section className={styles.specialists} aria-labelledby={`${instanceId}-specialists`}>
              <header>
                <span><Layers3 aria-hidden="true" /> Specialist passes</span>
                <strong id={`${instanceId}-specialists`}>{response.orchestration.passes.length} coordinated</strong>
              </header>
              <div>
                {response.orchestration.passes.map((pass) => (
                  <article data-status={pass.status} key={pass.id}>
                    <header>
                      <div><i aria-hidden="true" /><span>{titleCase(pass.role)}</span></div>
                      <small>{titleCase(pass.status)} · {pass.source} · {pass.model}</small>
                    </header>
                    {pass.review ? (
                      <div className={styles.passReview}>
                        <h4>{pass.review.status}</h4>
                        <p>{pass.review.summary}</p>
                        <dl>
                          <div><dt>Next test</dt><dd>{pass.review.nextTest}</dd></div>
                          <div><dt>Proposed move</dt><dd>{pass.review.proposedChanges[0]}</dd></div>
                        </dl>
                      </div>
                    ) : (
                      <p className={styles.passNotice}>{pass.notice || "This specialist pass returned no review."}</p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {response.capabilityNegotiation.declined.length ? (
              <section className={styles.capabilityDenials} aria-labelledby={`${instanceId}-capability-denials`}>
                <header><ShieldAlert aria-hidden="true" /><h4 id={`${instanceId}-capability-denials`}>Capabilities deliberately not granted</h4></header>
                <ul>
                  {response.capabilityNegotiation.declined.map((item) => (
                    <li key={item.capability}><strong>{titleCase(item.capability)}</strong><span>{item.reason}</span></li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className={styles.synthesis} aria-labelledby={`${instanceId}-synthesis`}>
              <header>
                <div><Orbit aria-hidden="true" /><span>Final Conductor synthesis</span></div>
                <strong>{response.review.status}</strong>
              </header>
              <h3 id={`${instanceId}-synthesis`}>{response.review.summary}</h3>
              <div className={styles.synthesisGrid}>
                <ReviewList title="Strengths" items={response.review.strengths} />
                <ReviewList title="Uncertainties" items={response.review.uncertainties} />
                <ReviewList title="Failure points" items={response.review.failurePoints} />
                <ReviewList title="Proposed changes" items={response.review.proposedChanges} />
              </div>
              <div className={styles.nextTest}>
                <FileCheck2 aria-hidden="true" />
                <div><span>Decisive next test</span><p>{response.review.nextTest}</p></div>
              </div>
            </section>

            <section className={styles.acceptance} data-current={bindingIsCurrent ? "true" : "false"}>
              <div>
                {bindingIsCurrent ? <ShieldCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
                <p>
                  <strong>{bindingIsCurrent ? "Exact revision binding confirmed" : "Project changed after this run"}</strong>
                  <span>{bindingIsCurrent ? "Acceptance creates a deliberate project revision; nothing applies automatically." : "Run Conductor again against the current project before accepting a proposal."}</span>
                </p>
              </div>
              <button
                type="button"
                disabled={acceptDisabled}
                onClick={() => response && onAcceptAsRevision(response)}
              >
                <GitCommitHorizontal aria-hidden="true" />
                {accepting ? "Accepting…" : "Accept as revision"}
              </button>
            </section>
          </div>
        ) : (
          <div className={styles.emptyRun}>
            <Orbit aria-hidden="true" />
            <h3>No Conductor run yet</h3>
            <p>Choose a reasoning depth and run the bound project. The phase plan, specialist judgments, synthesis, and provenance will appear here.</p>
          </div>
        )}
      </div>

      <div
        id={panelId("provenance")}
        className={styles.view}
        role="tabpanel"
        aria-labelledby={tabId("provenance")}
        hidden={tab !== "provenance"}
      >
        {response ? (
          <div className={styles.provenance}>
            <section className={styles.runIdentity}>
              <div><span>Run</span><code>{response.runId}</code></div>
              <div><span>Protocol</span><code>{response.protocolVersion}</code></div>
              <div><span>Provider result</span><strong>{response.source} · {response.model}</strong></div>
              <div><span>Completed</span><strong>{formatDateTime(response.completedAt)}</strong></div>
            </section>

            <section className={styles.usageSummary} aria-label="Run usage and latency">
              <article><Database aria-hidden="true" /><strong>{formatNumber(response.provenance.usage.inputTokens)}</strong><span>Input tokens</span></article>
              <article><Sparkles aria-hidden="true" /><strong>{formatNumber(response.provenance.usage.outputTokens)}</strong><span>Output tokens</span></article>
              <article><Activity aria-hidden="true" /><strong>{formatNumber(response.provenance.usage.totalTokens)}</strong><span>Total tokens</span></article>
              <article><Clock3 aria-hidden="true" /><strong>{formatLatency(totalLatency)}</strong><span>Provider latency</span></article>
            </section>

            <section className={styles.providerLedger} aria-labelledby={`${instanceId}-provider-ledger`}>
              <header>
                <span><GitBranch aria-hidden="true" /> Provider call ledger</span>
                <strong id={`${instanceId}-provider-ledger`}>{providerCalls.length} bounded calls</strong>
              </header>
              {providerCalls.length ? (
                <ol>
                  {providerCalls.map((call, index) => (
                    <li data-status={call.status} key={call.id}>
                      <span className={styles.callIndex}>{String(index + 1).padStart(2, "0")}</span>
                      <div className={styles.callMain}>
                        <strong>{titleCase(call.stage)} · {titleCase(call.role)}</strong>
                        <span>{call.model}</span>
                        {call.failureCode ? <em>{titleCase(call.failureCode)}</em> : null}
                      </div>
                      <dl>
                        <div><dt>Status</dt><dd>{titleCase(call.status)}</dd></div>
                        <div><dt>Latency</dt><dd>{formatLatency(call.latencyMs)}</dd></div>
                        <div><dt>Tokens</dt><dd>{formatNumber(call.usage.totalTokens)}</dd></div>
                      </dl>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.localNotice}>This result used deterministic local analysis; no provider call was made.</p>
              )}
            </section>

            <section className={styles.binding} aria-label="Exact project binding">
              <header><ShieldCheck aria-hidden="true" /><span>Exact graph binding</span></header>
              <dl>
                <div><dt>Project</dt><dd><code>{response.projectContext.projectId}</code></dd></div>
                <div><dt>Snapshot</dt><dd><code>{response.projectContext.snapshotId}</code></dd></div>
                <div><dt>Artifact</dt><dd><code>{response.projectContext.artifactId}</code></dd></div>
                <div><dt>Revision</dt><dd><code>{response.projectContext.artifactRevisionId}</code></dd></div>
                <div><dt>Snapshot hash</dt><dd><code>{response.projectContext.snapshotHash}</code></dd></div>
                <div><dt>Draft hash</dt><dd><code>{response.projectContext.draftHash}</code></dd></div>
              </dl>
              <p><ShieldCheck aria-hidden="true" /> {bindingIsCurrent ? "This binding still matches the caller’s active project revision." : "This binding is historical and cannot be accepted into the current revision."}</p>
            </section>
          </div>
        ) : (
          <div className={styles.emptyRun}>
            <Database aria-hidden="true" />
            <h3>No provenance record yet</h3>
            <p>Provider, model, token, latency, snapshot, and revision evidence appears only after a completed run.</p>
          </div>
        )}
      </div>
    </section>
  );
}
