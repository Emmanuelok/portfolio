"use client";

import {
  Activity,
  BookOpenCheck,
  CheckCircle2,
  CircleDot,
  GitBranch,
  Link2,
  ListChecks,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  type KeyboardEvent,
  useMemo,
  useRef,
  useState,
} from "react";

import { getPlatformPhase, PLATFORM_LIFECYCLE } from "@/lib/platform/registry";
import {
  PLATFORM_DECISION_LIMIT,
  PLATFORM_EVIDENCE_LIMIT,
} from "@/lib/platform/storage";
import type {
  PlatformDecisionStatus,
  PlatformEvidenceKind,
  PlatformProjectIntelligence,
} from "@/lib/platform/types";

import styles from "./ProjectIntelligencePanel.module.css";

const tabs = ["overview", "evidence", "decisions", "graph"] as const;
type IntelligenceTab = (typeof tabs)[number];

type ProjectIntelligencePanelProps = Readonly<{
  projectTitle: string;
  intelligence: PlatformProjectIntelligence;
  storageError?: string;
  onChange: (next: PlatformProjectIntelligence) => boolean;
}>;

function makeId(prefix: string) {
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${value}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function tabKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  current: IntelligenceTab,
  select: (tab: IntelligenceTab) => void,
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
  select(next);
  requestAnimationFrame(() => document.getElementById(`intelligence-tab-${next}`)?.focus());
}

export function ProjectIntelligencePanel({
  projectTitle,
  intelligence,
  storageError = "",
  onChange,
}: ProjectIntelligencePanelProps) {
  const [tab, setTab] = useState<IntelligenceTab>("overview");
  const [notice, setNotice] = useState("");
  const evidenceForm = useRef<HTMLFormElement>(null);
  const decisionForm = useRef<HTMLFormElement>(null);
  const activePhase = getPlatformPhase(intelligence.phase) ?? PLATFORM_LIFECYCLE[0];
  const completeness = useMemo(() => {
    const checks = [
      intelligence.objective.trim().length > 2,
      intelligence.evidence.length > 0,
      intelligence.decisions.some((decision) => decision.status === "accepted"),
      intelligence.agentRuns.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [intelligence]);

  const save = (next: PlatformProjectIntelligence, success: string) => {
    if (storageError) {
      setNotice("Project intelligence is read-only until the local storage error is resolved.");
      return false;
    }
    const saved = onChange({ ...next, updatedAt: new Date().toISOString() });
    setNotice(saved ? success : "This change could not be stored. Editable source remains safe.");
    return saved;
  };

  const addEvidence = (form: FormData) => {
    if (intelligence.evidence.length >= PLATFORM_EVIDENCE_LIMIT) {
      setNotice(`This project already contains ${PLATFORM_EVIDENCE_LIMIT} evidence records.`);
      return;
    }
    const kind = String(form.get("kind")) as PlatformEvidenceKind;
    const title = String(form.get("title") ?? "").trim();
    const source = String(form.get("source") ?? "").trim();
    const claim = String(form.get("claim") ?? "").trim();
    if (!title || (kind !== "note" && !source)) {
      setNotice("Give the evidence a title and source before adding it.");
      return;
    }
    const next = {
      ...intelligence,
      evidence: [{
        id: makeId("evidence"),
        kind,
        title: title.slice(0, 240),
        source: (source || "Workspace note").slice(0, 2_000),
        claim: claim.slice(0, 4_000),
        addedAt: new Date().toISOString(),
      }, ...intelligence.evidence],
    };
    if (save(next, "Evidence added to the project ledger.")) evidenceForm.current?.reset();
  };

  const addDecision = (form: FormData) => {
    if (intelligence.decisions.length >= PLATFORM_DECISION_LIMIT) {
      setNotice(`This project already contains ${PLATFORM_DECISION_LIMIT} decisions.`);
      return;
    }
    const title = String(form.get("title") ?? "").trim();
    const decision = String(form.get("decision") ?? "").trim();
    const rationale = String(form.get("rationale") ?? "").trim();
    const status = String(form.get("status")) as PlatformDecisionStatus;
    if (!title || !decision) {
      setNotice("Name the decision and record what was decided.");
      return;
    }
    const next = {
      ...intelligence,
      decisions: [{
        id: makeId("decision"),
        title: title.slice(0, 240),
        decision: decision.slice(0, 4_000),
        rationale: rationale.slice(0, 4_000),
        status,
        relatedArtifactIds: [],
        createdAt: new Date().toISOString(),
      }, ...intelligence.decisions],
    };
    if (save(next, "Decision recorded with the project.")) decisionForm.current?.reset();
  };

  return (
    <section className={styles.panel} aria-labelledby="project-intelligence-heading">
      <header className={styles.heading}>
        <div>
          <span><Sparkles aria-hidden="true" /> Project intelligence</span>
          <h2 id="project-intelligence-heading">Memory that travels with the work</h2>
          <p>{projectTitle || "Untitled project"} · {activePhase.label} phase</p>
        </div>
        <div className={styles.readiness} aria-label={`${completeness}% intelligence readiness`}>
          <strong>{completeness}%</strong>
          <span>readiness</span>
        </div>
      </header>

      <div className={styles.truthBoundary} data-error={Boolean(storageError)}>
        <ShieldCheck aria-hidden="true" />
        <p>
          {storageError
            ? `${storageError} This ledger is shown without overwriting the unreadable record.`
            : "Stored only in this browser. Nothing in this ledger is sent until you deliberately run an Agent review."}
        </p>
      </div>

      <nav className={styles.tabs} role="tablist" aria-label="Project intelligence views">
        {tabs.map((value) => (
          <button
            id={`intelligence-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`intelligence-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => tabKeyDown(event, tab, setTab)}
            key={value}
          >
            {value}
            {value === "evidence" ? <span>{intelligence.evidence.length}</span> : null}
            {value === "decisions" ? <span>{intelligence.decisions.length}</span> : null}
          </button>
        ))}
      </nav>

      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <div
        id="intelligence-panel-overview"
        className={styles.view}
        role="tabpanel"
        aria-labelledby="intelligence-tab-overview"
        hidden={tab !== "overview"}
      >
        <label className={styles.objective}>
          <span>North-star objective</span>
          <textarea
            key={`${intelligence.projectId}:${intelligence.objective}`}
            defaultValue={intelligence.objective}
            maxLength={6_000}
            rows={5}
            placeholder="State the change this project must create, for whom, and how success will be recognized."
            onBlur={(event) => {
              const objective = event.currentTarget.value.trim();
              if (objective === intelligence.objective) return;
              save({ ...intelligence, objective }, "Project objective updated.");
            }}
          />
        </label>
        <div className={styles.metrics}>
          <article><BookOpenCheck aria-hidden="true" /><strong>{intelligence.evidence.length}</strong><span>evidence records</span></article>
          <article><ListChecks aria-hidden="true" /><strong>{intelligence.decisions.length}</strong><span>decisions</span></article>
          <article><Activity aria-hidden="true" /><strong>{intelligence.agentRuns.length}</strong><span>accepted runs</span></article>
          <article><GitBranch aria-hidden="true" /><strong>{intelligence.artifactRelationships.length}</strong><span>relationships</span></article>
        </div>
        <section className={styles.lifecycle} aria-label="Project lifecycle position">
          <header><span>Lifecycle position</span><strong>{activePhase.action}</strong></header>
          <ol>
            {PLATFORM_LIFECYCLE.map((item) => (
              <li data-current={item.id === intelligence.phase} key={item.id}>
                <span>{item.index}</span><small>{item.label}</small>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div
        id="intelligence-panel-evidence"
        className={styles.view}
        role="tabpanel"
        aria-labelledby="intelligence-tab-evidence"
        hidden={tab !== "evidence"}
      >
        <form ref={evidenceForm} className={styles.entryForm} action={addEvidence}>
          <header><div><span>Evidence register</span><h3>Add a traceable reference</h3></div><Plus aria-hidden="true" /></header>
          <div className={styles.formGrid}>
            <label><span>Kind</span><select name="kind" defaultValue="note"><option value="note">Workspace note</option><option value="url">URL</option><option value="file">File reference</option><option value="platform">Platform record</option></select></label>
            <label><span>Title</span><input name="title" maxLength={240} required placeholder="What is this evidence?" /></label>
          </div>
          <label><span>Source</span><input name="source" maxLength={2_000} placeholder="URL, filename, dataset, interview, or Workspace note" /></label>
          <label><span>Claim supported or challenged</span><textarea name="claim" rows={3} maxLength={4_000} placeholder="Record what this reference actually establishes." /></label>
          <button type="submit" disabled={Boolean(storageError)}><Plus aria-hidden="true" /> Add evidence</button>
        </form>
        <ol className={styles.records}>
          {intelligence.evidence.map((item) => (
            <li key={item.id}>
              <div><span>{item.kind}</span><small>{formatDate(item.addedAt)}</small></div>
              <h3>{item.title}</h3>
              <p>{item.claim || "No claim annotation yet."}</p>
              <footer><code>{item.source}</code><button type="button" aria-label={`Remove ${item.title}`} onClick={() => save({ ...intelligence, evidence: intelligence.evidence.filter((entry) => entry.id !== item.id) }, "Evidence removed.")}><Trash2 aria-hidden="true" /></button></footer>
            </li>
          ))}
        </ol>
        {!intelligence.evidence.length ? <div className={styles.empty}><BookOpenCheck aria-hidden="true" /><p>No evidence recorded yet. Add the first observable fact, reference, or research note.</p></div> : null}
      </div>

      <div
        id="intelligence-panel-decisions"
        className={styles.view}
        role="tabpanel"
        aria-labelledby="intelligence-tab-decisions"
        hidden={tab !== "decisions"}
      >
        <form ref={decisionForm} className={styles.entryForm} action={addDecision}>
          <header><div><span>Decision log</span><h3>Make project judgment explicit</h3></div><CheckCircle2 aria-hidden="true" /></header>
          <div className={styles.formGrid}>
            <label><span>Decision name</span><input name="title" maxLength={240} required placeholder="Short decision title" /></label>
            <label><span>Status</span><select name="status" defaultValue="open"><option value="open">Open</option><option value="accepted">Accepted</option><option value="revisit">Revisit</option></select></label>
          </div>
          <label><span>Decision</span><textarea name="decision" rows={3} maxLength={4_000} required placeholder="What has been chosen or still needs resolution?" /></label>
          <label><span>Rationale</span><textarea name="rationale" rows={3} maxLength={4_000} placeholder="Why is this the strongest current decision?" /></label>
          <button type="submit" disabled={Boolean(storageError)}><Plus aria-hidden="true" /> Record decision</button>
        </form>
        <ol className={styles.records}>
          {intelligence.decisions.map((item) => (
            <li key={item.id} data-status={item.status}>
              <div><span>{item.status}</span><small>{formatDate(item.createdAt)}</small></div>
              <h3>{item.title}</h3><p>{item.decision}</p>
              {item.rationale ? <blockquote>{item.rationale}</blockquote> : null}
              <footer>
                <select aria-label={`Status for ${item.title}`} value={item.status} onChange={(event) => save({ ...intelligence, decisions: intelligence.decisions.map((entry) => entry.id === item.id ? { ...entry, status: event.target.value as PlatformDecisionStatus } : entry) }, "Decision status updated.")}><option value="open">Open</option><option value="accepted">Accepted</option><option value="revisit">Revisit</option></select>
                <button type="button" aria-label={`Remove ${item.title}`} onClick={() => save({ ...intelligence, decisions: intelligence.decisions.filter((entry) => entry.id !== item.id) }, "Decision removed.")}><Trash2 aria-hidden="true" /></button>
              </footer>
            </li>
          ))}
        </ol>
        {!intelligence.decisions.length ? <div className={styles.empty}><ListChecks aria-hidden="true" /><p>No decision recorded yet. Capture an open question or an accepted direction.</p></div> : null}
      </div>

      <div
        id="intelligence-panel-graph"
        className={styles.view}
        role="tabpanel"
        aria-labelledby="intelligence-tab-graph"
        hidden={tab !== "graph"}
      >
        <section className={styles.graph} aria-label="Project relationship graph">
          <div className={styles.graphCore}><Sparkles aria-hidden="true" /><span>Project</span><strong>{projectTitle || "Untitled"}</strong></div>
          <div className={styles.graphOrbit}>
            <article><BookOpenCheck aria-hidden="true" /><strong>{intelligence.evidence.length}</strong><span>Evidence</span></article>
            <article><ListChecks aria-hidden="true" /><strong>{intelligence.decisions.length}</strong><span>Decisions</span></article>
            <article><Activity aria-hidden="true" /><strong>{intelligence.agentRuns.length}</strong><span>Agent runs</span></article>
            <article><Link2 aria-hidden="true" /><strong>{intelligence.artifactRelationships.length}</strong><span>Links</span></article>
          </div>
        </section>
        <section className={styles.provenance}>
          <header><span>Accepted Agent provenance</span><strong>{intelligence.agentRuns.length} records</strong></header>
          {intelligence.agentRuns.map((run) => (
            <article key={run.id}>
              <CircleDot aria-hidden="true" />
              <div><strong>{run.summary}</strong><span>{run.role} · {run.phase} · {run.model}</span><code>{run.inputDigest.slice(0, 16)}… · {run.protocolVersion}</code></div>
            </article>
          ))}
          {!intelligence.agentRuns.length ? <p>No Agent result has been accepted into this project yet.</p> : null}
        </section>
      </div>
    </section>
  );
}
