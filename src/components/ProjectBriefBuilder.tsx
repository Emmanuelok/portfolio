"use client";

import { Check, Copy, Download, Mail } from "lucide-react";
import { useEffect, useState } from "react";

import { parseConcept } from "@/lib/workspace/local-analysis";
import { transformLabels } from "@/lib/workspace/presets";
import type { WorkspaceDraft, WorkspaceMode } from "@/lib/workspace/types";
import { workspaceModes } from "@/lib/workspace/types";

import styles from "./ProjectBriefBuilder.module.css";

type BriefState = Readonly<{
  problem: string;
  affected: string;
  evidence: string;
  future: string;
  constraints: string;
  investment: string;
  horizon: string;
}>;

type HandoffNotice = Readonly<{
  state: "ready" | "missing" | "invalid";
  heading: string;
  detail: string;
}>;

type CanvasHandoff = Readonly<{
  generatedAt: string;
  current: WorkspaceDraft;
  agentReview: Record<string, unknown> | null;
  versions: readonly unknown[];
}>;

const CANVAS_HANDOFF_KEY = "kingxford:canvas-handoff:v1";

const initialBrief: BriefState = {
  problem: "",
  affected: "",
  evidence: "",
  future: "",
  constraints: "",
  investment: "",
  horizon: "",
};

const queryPresets: Readonly<Record<string, Partial<BriefState>>> = {
  create: {
    problem: "I want to turn an early idea into a useful, testable digital product.",
    future: "A working prototype with a clear audience, evidence plan, and responsible delivery path.",
  },
  "digital-tool": {
    problem: "I need a digital tool that makes a difficult task substantially easier or more reliable.",
    future: "A focused, usable product that can be tested with the people who need it.",
  },
  "institutional-system": {
    problem: "I need to improve an institutional process or decision system that is currently fragmented.",
    future: "A coherent, accountable workflow with measurable outcomes.",
  },
  "research-ai": {
    problem: "I need a responsible research or AI instrument for a complex evidence problem.",
    future: "A transparent research workflow with traceable evidence, evaluation, and human oversight.",
  },
  operations: {
    problem: "I need to redesign an operation whose current workflow creates delay, duplication, or avoidable risk.",
    future: "A clearer system with practical controls, useful automation, and measurable performance.",
  },
  education: {
    problem: "I need a learning experience or education tool built around a real student or educator need.",
    future: "An accessible learning system that improves understanding, practice, and evidence of progress.",
  },
  "education-website": {
    problem: "I want to turn an education concept into a credible, accessible digital experience.",
    future: "A tested learning journey with clear content, interaction, and progress evidence.",
  },
  "science-website": {
    problem: "I want to make scientific evidence explorable without sacrificing rigor or provenance.",
    future: "An interactive evidence experience that communicates uncertainty and source quality clearly.",
  },
  "finance-website": {
    problem: "I need a financial intelligence experience that supports informed decisions without false certainty.",
    future: "A transparent interface with evidence, risk context, and clear decision boundaries.",
  },
  "personal-tool": {
    problem: "I need an everyday tool that helps people make a difficult recurring decision with less friction.",
    future: "A calm, trustworthy product that is useful without requiring specialist knowledge.",
  },
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringList(value: unknown) {
  return Array.isArray(value)
    ? value.map(asString).filter(Boolean)
    : [];
}

function parseCanvasHandoff(raw: string): CanvasHandoff | null {
  const parsed = asRecord(JSON.parse(raw));
  const current = asRecord(parsed?.current);
  const code = asRecord(current?.code);
  const mode = current?.mode;

  if (
    !parsed ||
    !current ||
    !code ||
    typeof mode !== "string" ||
    !workspaceModes.includes(mode as WorkspaceMode) ||
    typeof current.title !== "string" ||
    typeof current.text !== "string" ||
    typeof code.html !== "string" ||
    typeof code.css !== "string" ||
    typeof code.javascript !== "string"
  ) {
    return null;
  }

  return {
    generatedAt: asString(parsed.generatedAt),
    current: {
      mode: mode as WorkspaceMode,
      title: current.title,
      text: current.text,
      code: {
        html: code.html,
        css: code.css,
        javascript: code.javascript,
      },
    },
    agentReview: asRecord(parsed.agentReview),
    versions: Array.isArray(parsed.versions) ? parsed.versions : [],
  };
}

function usefulConceptValue(value: string, fallbackStart: string) {
  return value.startsWith(fallbackStart) ? "" : value;
}

function listSection(label: string, items: readonly string[]) {
  if (!items.length) return "";
  return `${label}\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function versionSummary(versions: readonly unknown[]) {
  const rows = versions.flatMap((value) => {
    const version = asRecord(value);
    const draft = asRecord(version?.draft);
    const name = asString(version?.name);
    const mode = asString(draft?.mode);
    const createdAt = asString(version?.createdAt);
    if (!name) return [];

    const details = [mode, createdAt].filter(Boolean).join(" · ");
    return [`${name}${details ? ` (${details})` : ""}`];
  });

  return listSection("CANVAS VERSIONS INCLUDED BY YOU", rows);
}

function buildHandoffBrief(handoff: CanvasHandoff): BriefState {
  const { current, agentReview, versions } = handoff;
  const concept = parseConcept(current.text, current.title || "Untitled concept");
  const buildBrief = asRecord(agentReview?.buildBrief);
  const currentSource =
    current.mode === "code"
      ? [
          `HTML\n${current.code.html}`,
          `CSS\n${current.code.css}`,
          `JAVASCRIPT\n${current.code.javascript}`,
        ].join("\n\n")
      : current.text.trim();

  const reviewSummary = asString(agentReview?.summary);
  const strengths = asStringList(agentReview?.strengths);
  const uncertainties = asStringList(agentReview?.uncertainties);
  const failurePoints = asStringList(agentReview?.failurePoints);
  const assumptions = asStringList(agentReview?.assumptions);
  const proposedChanges = asStringList(agentReview?.proposedChanges);
  const deliverables = asStringList(buildBrief?.deliverables);
  const nextTest = asString(agentReview?.nextTest);
  const audience = asString(buildBrief?.audience);
  const oneLine = asString(buildBrief?.oneLine);
  const coreExperience = asString(buildBrief?.coreExperience);

  const evidence = [
    usefulConceptValue(concept.evidence, "Define what would count"),
    reviewSummary ? `CANVAS AGENT REVIEW INCLUDED BY YOU\n${reviewSummary}` : "",
    listSection("STRENGTHS IDENTIFIED", strengths),
    listSection("UNKNOWNS TO RESOLVE", uncertainties),
    nextTest ? `NEXT TEST PROPOSED\n${nextTest}` : "",
    versionSummary(versions),
  ].filter(Boolean).join("\n\n");

  const constraints = [
    usefulConceptValue(concept.constraints, "Name the important limits"),
    listSection("FAILURE POINTS IDENTIFIED", failurePoints),
    listSection("ASSUMPTIONS TO VALIDATE", assumptions),
  ].filter(Boolean).join("\n\n");

  const future = [
    oneLine || usefulConceptValue(concept.change, "Describe the practical change"),
    coreExperience ? `CORE EXPERIENCE\n${coreExperience}` : "",
    listSection("PROPOSED CHANGES", proposedChanges),
    listSection("POSSIBLE DELIVERABLES", deliverables),
  ].filter(Boolean).join("\n\n");

  return {
    problem: [
      `${current.title || "Untitled concept"} · ${transformLabels[current.mode]}`,
      currentSource ? `CURRENT CANVAS SOURCE\n${currentSource}` : "",
    ].filter(Boolean).join("\n\n"),
    affected:
      audience ||
      usefulConceptValue(
        concept.audience,
        "The people and institutions who will use",
      ),
    evidence,
    future,
    constraints,
    investment: "",
    horizon: "",
  };
}

function formatHandoffTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function loadCanvasHandoff(): Readonly<{
  brief?: BriefState;
  notice: HandoffNotice;
}> | null {
  const search = new URLSearchParams(window.location.search);
  const briefType = search.get("brief");
  const world = search.get("world");
  if (briefType !== "workspace") {
    const preset = (briefType && queryPresets[briefType])
      || (world === "living-room" ? {
        problem: "I need a quiet, rigorous space to make sense of an important decision or emerging idea.",
        future: "A legible problem, explicit assumptions, and the smallest responsible next step.",
      } : null);
    if (!preset) return null;
    return {
      brief: { ...initialBrief, ...preset },
      notice: {
        state: "ready",
        heading: "A relevant starting frame has been prepared.",
        detail: "This is only a local prompt based on the route you selected. Review and replace every field before opening an email draft, copying, or downloading it.",
      },
    };
  }

  const raw = window.sessionStorage.getItem(CANVAS_HANDOFF_KEY);
  if (!raw) {
    return {
      notice: {
        state: "missing",
        heading: "No Canvas handoff was found in this tab.",
        detail:
          "The worksheet remains private and blank. Return to Canvas and choose “Prepare a build request” to carry a version here.",
      },
    };
  }

  try {
    const handoff = parseCanvasHandoff(raw);
    if (!handoff) {
      return {
        notice: {
          state: "invalid",
          heading: "This Canvas handoff could not be read safely.",
          detail:
            "Nothing was imported or submitted. You can continue with the blank worksheet or prepare a new handoff in Canvas.",
        },
      };
    }

    const preparedAt = formatHandoffTime(handoff.generatedAt);
    const context = [
      handoff.agentReview ? "agent review included" : "no agent review included",
      handoff.versions.length
        ? `${handoff.versions.length} saved version${handoff.versions.length === 1 ? "" : "s"} included`
        : "no saved versions included",
    ].join(" · ");

    return {
      brief: buildHandoffBrief(handoff),
      notice: {
        state: "ready",
        heading: `Canvas handoff ready: ${handoff.current.title || "Untitled concept"}`,
        detail: `Prefilled locally from the current ${transformLabels[handoff.current.mode].toLocaleLowerCase()}${preparedAt ? ` prepared ${preparedAt}` : ""} · ${context}. Opening this handoff did not submit it to Kingxford or make a new network request. Review and edit every field before you deliberately copy or download it.`,
      },
    };
  } catch {
    return {
      notice: {
        state: "invalid",
        heading: "This Canvas handoff could not be read safely.",
        detail:
          "Nothing was imported or submitted. You can continue with the blank worksheet or prepare a new handoff in Canvas.",
      },
    };
  }
}

function buildBrief(value: BriefState) {
  return [
    "COMPLEX PROBLEM BRIEF",
    "Prepared with kingXford & Co",
    "",
    `1. Problem or opportunity\n${value.problem || "Not yet defined"}`,
    `2. People and institutions affected\n${value.affected || "Not yet defined"}`,
    `3. Existing evidence and unknowns\n${value.evidence || "Not yet defined"}`,
    `4. Desired future and measurable change\n${value.future || "Not yet defined"}`,
    `5. Constraints, risks and dependencies\n${value.constraints || "Not yet defined"}`,
    `6. Available resources\n${value.investment || "Not yet defined"}`,
    `7. Time horizon\n${value.horizon || "Not yet defined"}`,
    "",
    "Next step: validate the problem definition with affected people, identify the evidence threshold, and design the smallest responsible test.",
  ].join("\n\n");
}

function buildMailtoUrl(email: string, brief: string) {
  const subject = "Kingxford complex problem brief";
  const prefix = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=`;
  let body = brief;
  let url = `${prefix}${encodeURIComponent(body)}`;
  while (url.length > 7_500 && body.length > 400) {
    body = `${body.slice(0, Math.max(400, body.length - 320)).trimEnd()}\n\n[Brief shortened for email compatibility. The full version can be attached from the downloaded file.]`;
    url = `${prefix}${encodeURIComponent(body)}`;
  }
  return url;
}

export function ProjectBriefBuilder({ contactEmail }: Readonly<{ contactEmail: string | null }>) {
  const [brief, setBrief] = useState<BriefState>(initialBrief);
  const [status, setStatus] = useState("");
  const [handoffNotice, setHandoffNotice] = useState<HandoffNotice | null>(null);
  const output = buildBrief(brief);
  const emailDraftUrl = contactEmail ? buildMailtoUrl(contactEmail, output) : null;

  useEffect(() => {
    const handoff = loadCanvasHandoff();
    if (!handoff) return;

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (handoff.brief) setBrief(handoff.brief);
      setHandoffNotice(handoff.notice);
    });

    return () => {
      active = false;
    };
  }, []);

  const update = (field: keyof BriefState, value: string) => {
    setBrief((current) => ({ ...current, [field]: value }));
    setStatus("");
  };

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setStatus("Brief copied. You can now share it through your chosen institutional channel.");
    } catch {
      setStatus("Copy was unavailable in this browser. Download the brief instead.");
    }
  };

  const downloadBrief = () => {
    const file = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kingxford-complex-problem-brief.txt";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Brief downloaded to your device.");
  };

  return (
    <section className={styles.builder} aria-labelledby="problem-brief-title">
      <header className={styles.heading}>
        <p className="eyebrow">Start with the brief</p>
        <h2 id="problem-brief-title">Define the problem before choosing the solution.</h2>
        <p>
          Use this private, browser-only worksheet to turn an ambitious idea or
          institutional challenge into a clearer starting point for research,
          development, and responsible delivery.
        </p>
      </header>

      {handoffNotice && (
        <aside
          className={styles.handoffNotice}
          data-state={handoffNotice.state}
          role="status"
        >
          <strong>{handoffNotice.heading}</strong>
          <p>{handoffNotice.detail}</p>
        </aside>
      )}

      <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <label className={styles.field}>
          <span>Problem or opportunity</span>
          <small>What is happening, and why does it matter now?</small>
          <textarea
            value={brief.problem}
            onChange={(event) => update("problem", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>People and institutions affected</span>
          <small>Who experiences the problem, carries the risk, or enables change?</small>
          <textarea
            value={brief.affected}
            onChange={(event) => update("affected", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Evidence and unknowns</span>
          <small>What is known, measured, assumed, or still disputed?</small>
          <textarea
            value={brief.evidence}
            onChange={(event) => update("evidence", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Desired future</span>
          <small>What should become more capable, equitable, resilient, or abundant?</small>
          <textarea
            value={brief.future}
            onChange={(event) => update("future", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Constraints and dependencies</span>
          <small>Consider time, policy, data, trust, finance, infrastructure, and risk.</small>
          <textarea
            value={brief.constraints}
            onChange={(event) => update("constraints", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Available resources</span>
          <small>Budget, expertise, research, time, infrastructure, networks, or trust.</small>
          <textarea
            value={brief.investment}
            onChange={(event) => update("investment", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Time horizon</span>
          <small>When must learning, a pilot, or a measurable outcome occur?</small>
          <select
            value={brief.horizon}
            onChange={(event) => update("horizon", event.target.value)}
          >
            <option value="">Choose a horizon</option>
            <option>Immediate response · 0–90 days</option>
            <option>Pilot and evidence · 3–12 months</option>
            <option>Institutional development · 1–3 years</option>
            <option>Long-horizon transformation · 3+ years</option>
          </select>
        </label>

        <div className={styles.actions}>
          {emailDraftUrl ? (
            <a className={styles.emailAction} href={emailDraftUrl}>
              <Mail aria-hidden="true" />
              Open email draft
            </a>
          ) : (
            <button type="button" disabled title="The project inbox has not been configured.">
              <Mail aria-hidden="true" />
              Email unavailable
            </button>
          )}
          <button type="button" onClick={copyBrief}>
            {status.startsWith("Brief copied") ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            Copy structured brief
          </button>
          <button type="button" onClick={downloadBrief}>
            <Download aria-hidden="true" />
            Download .txt
          </button>
          <p className={styles.status} aria-live="polite">{status}</p>
        </div>

        <p className={styles.privacy}>
          Privacy: this worksheet runs locally in your browser. It does not
          submit or transmit the information you enter, and changes made here
          are not saved automatically. Opening an email draft, copying, or
          downloading happens only when you choose that action; an email is
          never sent automatically.
        </p>
      </form>
    </section>
  );
}
