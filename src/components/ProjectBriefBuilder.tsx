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
  projectIntelligence: Record<string, unknown> | null;
  agentReview: Record<string, unknown> | null;
  versions: readonly unknown[];
}>;

const CANVAS_HANDOFF_KEY = "kingxford:canvas-handoff:v1";
const CANVAS_HANDOFF_CHARACTER_LIMIT = 1_000_000;
const CANVAS_HANDOFF_VERSION_LIMIT = 6;

const briefSelections: Readonly<Record<string, string>> = {
  create: "Open-ended creation or development need",
  "digital-tool": "Digital tool",
  "institutional-system": "Institutional system",
  "research-ai": "Research or responsible-AI tool",
  operations: "Operational tool",
  education: "Education tool",
  "personal-tool": "Everyday personal tool",
  "science-website": "Scientific-research website",
  "finance-website": "Institutional-finance website",
  "education-website": "Education website",
  lab: "Research and development challenge",
  "research-development": "Research and development challenge",
  "r-and-d": "Research and development challenge",
};

const initialBrief: BriefState = {
  problem: "",
  affected: "",
  evidence: "",
  future: "",
  constraints: "",
  investment: "",
  horizon: "",
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
    current.title.length > 120 ||
    typeof current.text !== "string" ||
    current.text.length > 250_000 ||
    typeof code.html !== "string" ||
    code.html.length > 500_000 ||
    typeof code.css !== "string" ||
    code.css.length > 500_000 ||
    typeof code.javascript !== "string" ||
    code.javascript.length > 500_000
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
    projectIntelligence:
      parsed.projectIntelligence === null
        ? null
        : asRecord(parsed.projectIntelligence),
    agentReview: asRecord(parsed.agentReview),
    versions: Array.isArray(parsed.versions)
      ? parsed.versions.slice(0, CANVAS_HANDOFF_VERSION_LIMIT)
      : [],
  };
}

function loadSelectedStartingPoint(search: URLSearchParams): Readonly<{
  brief: BriefState;
  notice: HandoffNotice;
}> | null {
  const briefKey = search.get("brief")?.trim().toLocaleLowerCase() ?? "";
  const worldKey = search.get("world")?.trim().toLocaleLowerCase() ?? "";
  const label = briefSelections[briefKey] ?? (
    worldKey === "living-room" ? "Complex mandate or uncommon brief" : ""
  );

  if (!label) return null;

  return {
    brief: {
      ...initialBrief,
      problem: `Selected starting point: ${label}.`,
    },
    notice: {
      state: "ready",
      heading: `Starting point selected: ${label}`,
      detail:
        "Only the project direction you deliberately selected was prefilled. No scope, evidence, budget, timeline, requirement, or result was inferred, and nothing was submitted. Replace or expand the starting point with your actual context before copying or downloading the brief.",
    },
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
  const { current, projectIntelligence, agentReview, versions } = handoff;
  const concept = parseConcept(current.text, current.title || "Untitled concept");
  const buildBrief = asRecord(agentReview?.buildBrief);
  const phase = asString(projectIntelligence?.phase);
  const objective = asString(projectIntelligence?.objective);
  const projectEvidence = Array.isArray(projectIntelligence?.evidence)
    ? projectIntelligence.evidence.flatMap((value) => {
        const entry = asRecord(value);
        const title = asString(entry?.title);
        const claim = asString(entry?.claim);
        const source = asString(entry?.source);
        if (!title && !claim) return [];
        return [
          [title, claim, source ? `Source: ${source}` : ""]
            .filter(Boolean)
            .join(" — "),
        ];
      })
    : [];
  const projectDecisions = Array.isArray(projectIntelligence?.decisions)
    ? projectIntelligence.decisions.flatMap((value) => {
        const entry = asRecord(value);
        const title = asString(entry?.title);
        const decision = asString(entry?.decision);
        const rationale = asString(entry?.rationale);
        if (!title && !decision) return [];
        return [
          [title, decision, rationale ? `Rationale: ${rationale}` : ""]
            .filter(Boolean)
            .join(" — "),
        ];
      })
    : [];
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
    phase ? `CURRENT PROJECT PHASE\n${phase}` : "",
    objective ? `PROJECT OBJECTIVE\n${objective}` : "",
    listSection("PROJECT EVIDENCE REGISTER", projectEvidence),
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
    listSection("PROJECT DECISION LOG", projectDecisions),
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
  if (search.get("brief") !== "workspace") {
    return loadSelectedStartingPoint(search);
  }

  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(CANVAS_HANDOFF_KEY);
  } catch {
    return {
      notice: {
        state: "invalid",
        heading: "Canvas handoff storage is unavailable in this browser.",
        detail:
          "Nothing was imported or submitted. Your Canvas project remains unchanged; return to Canvas and export the current project if you need a portable copy.",
      },
    };
  }

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

  if (raw.length > CANVAS_HANDOFF_CHARACTER_LIMIT) {
    return {
      notice: {
        state: "invalid",
        heading: "This Canvas handoff is too large to prefill safely.",
        detail:
          "Nothing was imported or submitted. Return to Canvas, exclude optional Agent or version context, or export the project as a Canvas bundle.",
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
    `6. Available investment\n${value.investment || "Not yet defined"}`,
    `7. Time horizon\n${value.horizon || "Not yet defined"}`,
    "",
    "Next step: validate the problem definition with affected people, identify the evidence threshold, and design the smallest responsible test.",
  ].join("\n\n");
}

export function ProjectBriefBuilder({
  contactEmail = null,
}: Readonly<{ contactEmail?: string | null }>) {
  const [brief, setBrief] = useState<BriefState>(initialBrief);
  const [status, setStatus] = useState("");
  const [handoffNotice, setHandoffNotice] = useState<HandoffNotice | null>(null);
  const output = buildBrief(brief);

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

  const openEmailDraft = () => {
    if (!contactEmail) return;
    const title = brief.problem.split("\n", 1)[0]?.trim() || "Project brief";
    const href = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(
      `Kingxford build brief — ${title.slice(0, 100)}`,
    )}&body=${encodeURIComponent(output)}`;

    if (href.length > 8_000) {
      setStatus(
        "This brief is too large for a dependable email draft. Download the .txt file and attach it through your email app.",
      );
      return;
    }

    window.location.href = href;
    setStatus(
      "An addressed draft was opened in your email app. Review it there and send only when you choose.",
    );
  };

  return (
    <section className={styles.builder} aria-labelledby="problem-brief-title">
      <header className={styles.heading}>
        <p className="eyebrow">A useful first investment</p>
        <h2 id="problem-brief-title">Make the problem legible.</h2>
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
          <span>Available investment</span>
          <small>Capital, expertise, research, time, infrastructure, networks, or trust.</small>
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
          {contactEmail ? (
            <button
              className={styles.emailAction}
              type="button"
              onClick={openEmailDraft}
            >
              <Mail aria-hidden="true" />
              Open addressed email draft
            </button>
          ) : null}
          <p className={styles.status} aria-live="polite">{status}</p>
        </div>

        <p className={styles.privacy}>
          Privacy: this worksheet runs locally in your browser. It does not
          submit or transmit the information you enter, and changes made here
          are not saved automatically. Copying or downloading creates a copy
          only when you choose that action. If the addressed-draft option is
          configured, it opens your email app; it never sends on your behalf.
        </p>
      </form>
    </section>
  );
}
