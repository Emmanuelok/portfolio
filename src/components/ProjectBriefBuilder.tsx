"use client";

import { Check, Copy, Download, Mail, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  CONTACT_LIMITS,
  CONTACT_RETENTION_TARGET_DAYS,
  contactHorizons,
  validatedContactEmail,
  type ContactHorizon,
} from "@/lib/contact/contracts";
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
  horizon: "" | ContactHorizon;
}>;

type ContactState = Readonly<{
  name: string;
  email: string;
  organization: string;
  consent: boolean;
  website: string;
}>;

type FormStatus = Readonly<{
  state: "idle" | "working" | "success" | "error" | "notice";
  message: string;
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

const initialContact: ContactState = {
  name: "",
  email: "",
  organization: "",
  consent: false,
  website: "",
};

const idleStatus: FormStatus = { state: "idle", message: "" };

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

function buildBrief(value: BriefState, contact: ContactState) {
  const contactLines = [
    contact.name ? `Name: ${contact.name}` : "",
    contact.email ? `Email: ${contact.email}` : "",
    contact.organization ? `Organization: ${contact.organization}` : "",
  ].filter(Boolean);

  return [
    "COMPLEX PROBLEM BRIEF",
    "Prepared with kingXford & Co",
    contactLines.length ? `\nCONTACT\n${contactLines.join("\n")}` : "",
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

export function ProjectBriefBuilder({
  contactEmail,
  onlineSubmissionAvailable,
  onlineSubmissionDurable,
}: Readonly<{
  contactEmail: string | null;
  onlineSubmissionAvailable: boolean;
  onlineSubmissionDurable: boolean;
}>) {
  const [brief, setBrief] = useState<BriefState>(initialBrief);
  const [contact, setContact] = useState<ContactState>(initialContact);
  const [status, setStatus] = useState<FormStatus>(idleStatus);
  const [submitting, setSubmitting] = useState(false);
  const [handoffNotice, setHandoffNotice] = useState<HandoffNotice | null>(null);
  const idempotencyKey = useRef("");
  const output = buildBrief(brief, contact);
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
    setBrief((current) => ({ ...current, [field]: value } as BriefState));
    setStatus(idleStatus);
  };

  const updateContact = (
    field: keyof ContactState,
    value: string | boolean,
  ) => {
    setContact((current) => ({ ...current, [field]: value } as ContactState));
    setStatus(idleStatus);
  };

  const copyBrief = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setStatus({
        state: "notice",
        message:
          "Brief copied. You can now share it through your chosen institutional channel.",
      });
    } catch {
      setStatus({
        state: "error",
        message: "Copy was unavailable in this browser. Download the brief instead.",
      });
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
    setStatus({ state: "notice", message: "Brief downloaded to your device." });
  };

  const submitEnquiry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!onlineSubmissionAvailable) {
      setStatus({
        state: "error",
        message:
          "Online delivery is not configured on this deployment. Nothing was submitted. Use the email, copy, or download option instead.",
      });
      return;
    }

    const requiredTextIsValid =
      contact.name.trim().length >= 2 &&
      validatedContactEmail(contact.email.trim()) !== null &&
      brief.problem.trim().length >= 30 &&
      brief.affected.trim().length >= 10 &&
      brief.future.trim().length >= 10 &&
      brief.horizon !== "" &&
      contact.consent;
    const fieldsWithinLimits =
      contact.name.length <= CONTACT_LIMITS.name &&
      contact.email.length <= CONTACT_LIMITS.email &&
      contact.organization.length <= CONTACT_LIMITS.organization &&
      brief.problem.length <= CONTACT_LIMITS.problem &&
      brief.affected.length <= CONTACT_LIMITS.affected &&
      brief.evidence.length <= CONTACT_LIMITS.evidence &&
      brief.future.length <= CONTACT_LIMITS.future &&
      brief.constraints.length <= CONTACT_LIMITS.constraints &&
      brief.investment.length <= CONTACT_LIMITS.investment;

    if (!requiredTextIsValid || !fieldsWithinLimits) {
      setStatus({
        state: "error",
        message:
          "Complete the required contact and brief fields, choose a time horizon, and confirm consent. The problem needs at least 30 characters; the affected group and desired future need at least 10 each.",
      });
      return;
    }

    if (!idempotencyKey.current) {
      idempotencyKey.current = globalThis.crypto.randomUUID();
    }

    setSubmitting(true);
    setStatus({
      state: "working",
      message: "Requesting secure delivery…",
    });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          name: contact.name,
          email: contact.email,
          organization: contact.organization,
          brief,
          consent: contact.consent,
          website: contact.website,
        }),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as {
        submitted?: unknown;
        message?: unknown;
        error?: unknown;
        requestId?: unknown;
      } | null;

      if (response.ok && result?.submitted === true) {
        const reference =
          typeof result.requestId === "string" ? ` Reference: ${result.requestId}.` : "";
        setStatus({
          state: "success",
          message: `Your enquiry was accepted for delivery.${reference}`,
        });
        return;
      }

      setStatus({
        state: "error",
        message:
          typeof result?.error === "string"
            ? result.error
            : "The enquiry was not accepted. Your browser copy is unchanged; use email, copy, or download instead.",
      });
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error instanceof DOMException && error.name === "AbortError"
            ? "Delivery timed out. No successful submission was confirmed. Retry once or use email, copy, or download."
            : "Delivery could not be confirmed. Your browser copy is unchanged; retry once or use email, copy, or download.",
      });
    } finally {
      window.clearTimeout(timeout);
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.builder} aria-labelledby="problem-brief-title">
      <header className={styles.heading}>
        <p className="eyebrow">Start with the brief</p>
        <h2 id="problem-brief-title">Define the problem before choosing the solution.</h2>
        <p>
          Use this browser-first worksheet to turn an ambitious idea or
          institutional challenge into a clearer starting point. Nothing leaves
          the page until you deliberately submit it or open an email draft.
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

      <form
        className={styles.form}
        onSubmit={submitEnquiry}
        aria-busy={submitting}
        noValidate
      >
        <div className={styles.formIntro}>
          <p className="eyebrow">Contact record</p>
          <h3>Identify who should receive the response.</h3>
          <p>
            Only the details you deliberately submit are delivered. Credentials,
            private keys, and unnecessary personal information should never be
            included.
          </p>
        </div>

        <label className={styles.field}>
          <span>Your name *</span>
          <small>The person responsible for this enquiry.</small>
          <input
            type="text"
            autoComplete="name"
            value={contact.name}
            maxLength={CONTACT_LIMITS.name}
            onChange={(event) => updateContact("name", event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Email *</span>
          <small>A working address for a considered response.</small>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={contact.email}
            maxLength={CONTACT_LIMITS.email}
            onChange={(event) => updateContact("email", event.target.value)}
            required
          />
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Organization</span>
          <small>Institution, company, research group, or independent practice.</small>
          <input
            type="text"
            autoComplete="organization"
            value={contact.organization}
            maxLength={CONTACT_LIMITS.organization}
            onChange={(event) => updateContact("organization", event.target.value)}
          />
        </label>

        <div className={styles.formIntro}>
          <p className="eyebrow">Project record</p>
          <h3>Describe the work before prescribing the technology.</h3>
        </div>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Problem or opportunity</span>
          <small>What is happening, and why does it matter now?</small>
          <textarea
            value={brief.problem}
            maxLength={CONTACT_LIMITS.problem}
            onChange={(event) => update("problem", event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>People and institutions affected</span>
          <small>Who experiences the problem, carries the risk, or enables change?</small>
          <textarea
            value={brief.affected}
            maxLength={CONTACT_LIMITS.affected}
            onChange={(event) => update("affected", event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Evidence and unknowns</span>
          <small>What is known, measured, assumed, or still disputed?</small>
          <textarea
            value={brief.evidence}
            maxLength={CONTACT_LIMITS.evidence}
            onChange={(event) => update("evidence", event.target.value)}
          />
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Desired future</span>
          <small>What should become more capable, equitable, resilient, or abundant?</small>
          <textarea
            value={brief.future}
            maxLength={CONTACT_LIMITS.future}
            onChange={(event) => update("future", event.target.value)}
            required
          />
        </label>

        <label className={styles.field}>
          <span>Constraints and dependencies</span>
          <small>Consider time, policy, data, trust, finance, infrastructure, and risk.</small>
          <textarea
            value={brief.constraints}
            maxLength={CONTACT_LIMITS.constraints}
            onChange={(event) => update("constraints", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Available resources</span>
          <small>Budget, expertise, research, time, infrastructure, networks, or trust.</small>
          <textarea
            value={brief.investment}
            maxLength={CONTACT_LIMITS.investment}
            onChange={(event) => update("investment", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Time horizon</span>
          <small>When must learning, a pilot, or a measurable outcome occur?</small>
          <select
            value={brief.horizon}
            onChange={(event) => update("horizon", event.target.value)}
            required
          >
            <option value="">Choose a horizon</option>
            {contactHorizons.map((horizon) => (
              <option key={horizon}>{horizon}</option>
            ))}
          </select>
        </label>

        <div className={styles.honeypot} aria-hidden="true">
          <label>
            Leave this field empty
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={contact.website}
              onChange={(event) => updateContact("website", event.target.value)}
            />
          </label>
        </div>

        <label className={styles.consent}>
          <input
            type="checkbox"
            checked={contact.consent}
            onChange={(event) => updateContact("consent", event.target.checked)}
            aria-describedby="project-enquiry-privacy"
            required
          />
          <span>
            I authorize kingXford &amp; Co to use the information in this enquiry
            to assess the project and respond. I have read the{" "}
            <Link href="/privacy">Privacy Statement</Link>.
          </span>
        </label>

        <div
          className={styles.availability}
          data-state={onlineSubmissionAvailable ? "available" : "unavailable"}
          role="status"
        >
          <strong>
            {onlineSubmissionAvailable
              ? onlineSubmissionDurable
                ? "Protected online delivery is available."
                : "Online delivery is available for local testing."
              : "Online delivery is not ready on this deployment."}
          </strong>
          <p>
            {onlineSubmissionAvailable
              ? onlineSubmissionDurable
                ? "Submissions are protected by a distributed low-volume allowance. A successful response means the delivery provider accepted the enquiry; it does not promise a project engagement or immediate reply."
                : "This non-durable mode is intended only for local development and must not be used on a shared deployment."
              : contactEmail
                ? "Nothing entered here will be submitted online. Use the email draft, copy, or download option when you are ready."
                : "Nothing entered here will be submitted online. Copy or download the brief and share it through a channel you trust."}
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            disabled={submitting || !onlineSubmissionAvailable}
            title={
              onlineSubmissionAvailable
                ? undefined
                : "Online delivery has not been configured."
            }
          >
            {status.state === "success" ? (
              <Check aria-hidden="true" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {submitting
              ? "Submitting…"
              : onlineSubmissionAvailable
                ? "Submit project enquiry"
                : "Online submission unavailable"}
          </button>
          {emailDraftUrl ? (
            <a className={styles.emailAction} data-kind="secondary" href={emailDraftUrl}>
              <Mail aria-hidden="true" />
              Open email draft
            </a>
          ) : (
            <button
              type="button"
              data-kind="secondary"
              disabled
              title="A public project email has not been configured."
            >
              <Mail aria-hidden="true" />
              Email fallback unavailable
            </button>
          )}
          <button type="button" data-kind="secondary" onClick={copyBrief}>
            <Copy aria-hidden="true" />
            Copy structured brief
          </button>
          <button type="button" data-kind="secondary" onClick={downloadBrief}>
            <Download aria-hidden="true" />
            Download .txt
          </button>
          <p
            className={styles.status}
            data-state={status.state}
            role={status.state === "error" ? "alert" : "status"}
            aria-live={status.state === "error" ? "assertive" : "polite"}
          >
            {status.message}
          </p>
        </div>

        <p className={styles.privacy} id="project-enquiry-privacy">
          Until you deliberately submit or open an email draft, this worksheet
          remains in your browser and is not saved automatically. Submitted
          enquiries are delivered to the project inbox and retained only as
          described in the <Link href="/privacy">Privacy Statement</Link>, with a
          target of deleting inactive enquiry material within{" "}
          {CONTACT_RETENTION_TARGET_DAYS} days. Copy and download remain available
          even if online delivery is interrupted.
        </p>
      </form>
    </section>
  );
}
