"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Landmark,
  Scale,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";

import type { WebsiteShowcase } from "@/data/creations";

import styles from "./FinanceExperience.module.css";

type FinanceExperienceProps = Readonly<{
  showcase: WebsiteShowcase;
}>;

type CaseId = "operating-plan" | "evidence-currency" | "approval-conditions";
type ScenarioId = "base" | "pressure" | "severe";
type EvidenceStatus = "current" | "review-due" | "challenged";
type EvidenceFilter = "all" | EvidenceStatus;
type GuardrailId = "purpose" | "evidence" | "conflicts" | "review-route";

type ScenarioMetric = Readonly<{
  label: string;
  value: string;
}>;

type Scenario = Readonly<{
  id: ScenarioId;
  label: string;
  index: number;
  note: string;
  metrics: readonly ScenarioMetric[];
}>;

type GovernanceEvent = Readonly<{
  id: string;
  role: string;
  action: string;
  state: string;
  rationale: string;
  condition: string;
  timestamp: string;
}>;

type EvidenceRecord = Readonly<{
  id: string;
  title: string;
  status: EvidenceStatus;
  method: string;
  evidenceDate: string;
  limitation: string;
  owner: string;
}>;

type FinanceCase = Readonly<{
  id: CaseId;
  record: string;
  shortLabel: string;
  summary: string;
  question: string;
  mandate: string;
  indexLabel: string;
  scenarios: readonly Scenario[];
  guardrailDefaults: Readonly<Record<GuardrailId, boolean>>;
  governance: readonly GovernanceEvent[];
  evidence: readonly EvidenceRecord[];
}>;

const GUARDRAILS: readonly Readonly<{
  id: GuardrailId;
  name: string;
  description: string;
}>[] = [
  {
    id: "purpose",
    name: "Purpose alignment",
    description: "The question remains inside the fictional mandate and its stated boundaries.",
  },
  {
    id: "evidence",
    name: "Evidence current",
    description: "Dates, sources, assumptions, and review status are visible in the file.",
  },
  {
    id: "conflicts",
    name: "Conflicts declared",
    description: "The demonstration record includes a completed conflict declaration.",
  },
  {
    id: "review-route",
    name: "Review route defined",
    description: "Challenge, approval, conditions, and the next review point have named roles.",
  },
] as const;

const FINANCE_CASES: readonly FinanceCase[] = [
  {
    id: "operating-plan",
    record: "MFO–24–07",
    shortLabel: "Operating-plan resilience",
    summary: "A synthetic sensitivity file for an illustrative institution.",
    question:
      "How does an illustrative operating plan change under delayed receipts and higher financing costs?",
    mandate:
      "Preserve programme continuity while making uncertainty, decision rights, and review conditions inspectable.",
    indexLabel: "Demonstration headroom index",
    scenarios: [
      {
        id: "base",
        label: "Base",
        index: 100,
        note: "Reference assumptions for comparing the two demonstration pressure states.",
        metrics: [
          { label: "Financing-cost change", value: "0.00 pp" },
          { label: "Receipt delay", value: "5 days" },
          { label: "Operating-cost change", value: "+2%" },
        ],
      },
      {
        id: "pressure",
        label: "Pressure",
        index: 72,
        note: "A synthetic pressure state with every changed assumption shown explicitly.",
        metrics: [
          { label: "Financing-cost change", value: "+1.25 pp" },
          { label: "Receipt delay", value: "30 days" },
          { label: "Operating-cost change", value: "+6%" },
        ],
      },
      {
        id: "severe",
        label: "Severe",
        index: 44,
        note: "A more demanding demonstration state for testing the clarity of the review path.",
        metrics: [
          { label: "Financing-cost change", value: "+2.50 pp" },
          { label: "Receipt delay", value: "60 days" },
          { label: "Operating-cost change", value: "+10%" },
        ],
      },
    ],
    guardrailDefaults: {
      purpose: true,
      evidence: true,
      conflicts: false,
      "review-route": true,
    },
    governance: [
      {
        id: "op-research",
        role: "Research lead",
        action: "Frames the sensitivity question",
        state: "Recorded",
        rationale: "The file separates the reference case from the two synthetic pressure states.",
        condition: "No state is presented as a forecast, recommendation, or measured outcome.",
        timestamp: "Cycle 04 · Step 01",
      },
      {
        id: "op-risk",
        role: "Risk function",
        action: "Challenges the receipt-delay assumption",
        state: "Challenge open",
        rationale: "The evidence packet does not yet explain how the illustrative delay range was selected.",
        condition: "Attach the range note before the file is marked ready for fictional review.",
        timestamp: "Cycle 04 · Step 02",
      },
      {
        id: "op-committee",
        role: "Committee",
        action: "Reviews the decision conditions",
        state: "Awaiting review",
        rationale: "The committee view remains unavailable until every guardrail is resolved.",
        condition: "The interface records review status only; it does not approve a financial action.",
        timestamp: "Cycle 04 · Step 03",
      },
      {
        id: "op-governance",
        role: "Governance office",
        action: "Preserves the review trail",
        state: "Route defined",
        rationale: "Versions, challenges, conditions, and responsible roles remain attached to the file.",
        condition: "Schedule a fictional review checkpoint after the open challenge is resolved.",
        timestamp: "Cycle 04 · Step 04",
      },
    ],
    evidence: [
      {
        id: "RN–12",
        title: "Financing-cost sensitivity method",
        status: "current",
        method: "Synthetic scenario definition",
        evidenceDate: "Demonstration cycle 04",
        limitation: "The index is an arbitrary interface scale, not a financial model or solvency measure.",
        owner: "Research lead",
      },
      {
        id: "DL–04",
        title: "Receipts timing assumptions",
        status: "challenged",
        method: "Illustrative assumption range",
        evidenceDate: "Demonstration cycle 03",
        limitation: "The source for the fictional range is intentionally unresolved in this interface state.",
        owner: "Risk function",
      },
      {
        id: "MN–09",
        title: "Operating-cost range note",
        status: "review-due",
        method: "Synthetic comparison note",
        evidenceDate: "Demonstration cycle 02",
        limitation: "No real institution, cost base, or operating result is represented.",
        owner: "Governance office",
      },
    ],
  },
  {
    id: "evidence-currency",
    record: "MFO–24–11",
    shortLabel: "Evidence currency",
    summary: "A review file for dated assumptions and source coverage.",
    question: "Which parts of a fictional decision file need refreshed evidence before review?",
    mandate:
      "Expose evidence age, traceability, challenge status, and responsible roles before a consequential review.",
    indexLabel: "Evidence currency index",
    scenarios: [
      {
        id: "base",
        label: "Base",
        index: 92,
        note: "Most synthetic records sit inside the illustrative review window.",
        metrics: [
          { label: "Oldest core evidence", value: "45 days" },
          { label: "Entries due review", value: "1" },
          { label: "Source trace coverage", value: "94%" },
        ],
      },
      {
        id: "pressure",
        label: "Pressure",
        index: 70,
        note: "Several records have crossed the fictional review threshold.",
        metrics: [
          { label: "Oldest core evidence", value: "120 days" },
          { label: "Entries due review", value: "4" },
          { label: "Source trace coverage", value: "78%" },
        ],
      },
      {
        id: "severe",
        label: "Severe",
        index: 46,
        note: "The demonstration file exposes substantial source and review gaps.",
        metrics: [
          { label: "Oldest core evidence", value: "240 days" },
          { label: "Entries due review", value: "8" },
          { label: "Source trace coverage", value: "61%" },
        ],
      },
    ],
    guardrailDefaults: {
      purpose: true,
      evidence: false,
      conflicts: true,
      "review-route": true,
    },
    governance: [
      {
        id: "ev-research",
        role: "Research lead",
        action: "Maps the source record",
        state: "Recorded",
        rationale: "Every synthetic note is linked to a method, evidence cycle, owner, and limitation.",
        condition: "Refresh entries marked review due before changing their status.",
        timestamp: "Cycle 06 · Step 01",
      },
      {
        id: "ev-risk",
        role: "Risk function",
        action: "Tests evidence age",
        state: "Challenge open",
        rationale: "One source packet exceeds the fictional evidence-age threshold.",
        condition: "The interface must retain the older record alongside any replacement.",
        timestamp: "Cycle 06 · Step 02",
      },
      {
        id: "ev-committee",
        role: "Committee",
        action: "Reviews the evidence boundary",
        state: "Awaiting review",
        rationale: "The file distinguishes known, assumed, challenged, and unresolved material.",
        condition: "No conclusion is shown while the evidence-current guardrail remains open.",
        timestamp: "Cycle 06 · Step 03",
      },
      {
        id: "ev-governance",
        role: "Governance office",
        action: "Versions the source register",
        state: "Route defined",
        rationale: "The prior and current demonstration records remain available for inspection.",
        condition: "Record the fictional refresh date and responsible role.",
        timestamp: "Cycle 06 · Step 04",
      },
    ],
    evidence: [
      {
        id: "SR–18",
        title: "Source traceability register",
        status: "current",
        method: "Synthetic source inventory",
        evidenceDate: "Demonstration cycle 06",
        limitation: "Coverage percentages measure interface completeness only.",
        owner: "Research lead",
      },
      {
        id: "AG–07",
        title: "Assumption-age review",
        status: "review-due",
        method: "Illustrative evidence-age rule",
        evidenceDate: "Demonstration cycle 04",
        limitation: "The review threshold is fictional and not a regulatory standard.",
        owner: "Governance office",
      },
      {
        id: "CH–03",
        title: "Unresolved source challenge",
        status: "challenged",
        method: "Demonstration challenge note",
        evidenceDate: "Demonstration cycle 05",
        limitation: "No conclusion is attached while the source remains challenged.",
        owner: "Risk function",
      },
    ],
  },
  {
    id: "approval-conditions",
    record: "MFO–25–02",
    shortLabel: "Approval conditions",
    summary: "A fictional record of challenge, review, and conditions.",
    question: "Can a complex institutional review preserve its conditions after the meeting ends?",
    mandate:
      "Keep rationale, dissent, conditions, accountable roles, and the next review point attached to the file.",
    indexLabel: "Decision-file completeness index",
    scenarios: [
      {
        id: "base",
        label: "Base",
        index: 96,
        note: "The demonstration file has no unresolved condition and a complete review route.",
        metrics: [
          { label: "Unresolved conditions", value: "0" },
          { label: "Challenge notes", value: "1" },
          { label: "Accountable checkpoints", value: "5" },
        ],
      },
      {
        id: "pressure",
        label: "Pressure",
        index: 74,
        note: "Two fictional conditions require owners and due points before review closure.",
        metrics: [
          { label: "Unresolved conditions", value: "2" },
          { label: "Challenge notes", value: "3" },
          { label: "Accountable checkpoints", value: "4" },
        ],
      },
      {
        id: "severe",
        label: "Severe",
        index: 51,
        note: "The interface marks the fictional file incomplete rather than hiding open conditions.",
        metrics: [
          { label: "Unresolved conditions", value: "5" },
          { label: "Challenge notes", value: "6" },
          { label: "Accountable checkpoints", value: "2" },
        ],
      },
    ],
    guardrailDefaults: {
      purpose: true,
      evidence: true,
      conflicts: true,
      "review-route": false,
    },
    governance: [
      {
        id: "ap-research",
        role: "Research lead",
        action: "Assembles the decision file",
        state: "Recorded",
        rationale: "The question, assumptions, limitations, and evidence packets are visible together.",
        condition: "Retain the synthetic-data disclosure in every exported view.",
        timestamp: "Cycle 08 · Step 01",
      },
      {
        id: "ap-risk",
        role: "Risk function",
        action: "Records a dissenting condition",
        state: "Condition open",
        rationale: "The next review point does not yet have an accountable role.",
        condition: "Assign the fictional review route before the file is marked ready.",
        timestamp: "Cycle 08 · Step 02",
      },
      {
        id: "ap-committee",
        role: "Committee",
        action: "Reviews without erasing dissent",
        state: "Awaiting review",
        rationale: "Challenge notes remain visible beside the majority rationale.",
        condition: "This demonstration records process state only, not authorization or advice.",
        timestamp: "Cycle 08 · Step 03",
      },
      {
        id: "ap-governance",
        role: "Governance office",
        action: "Defines the next checkpoint",
        state: "Route incomplete",
        rationale: "One accountable review role is still missing from the fictional file.",
        condition: "Resolve the review-route guardrail before closing the demonstration record.",
        timestamp: "Cycle 08 · Step 04",
      },
    ],
    evidence: [
      {
        id: "DM–21",
        title: "Decision mandate record",
        status: "current",
        method: "Synthetic mandate template",
        evidenceDate: "Demonstration cycle 08",
        limitation: "The record is not an authorization, instruction, or regulated document.",
        owner: "Research lead",
      },
      {
        id: "CN–08",
        title: "Open condition note",
        status: "challenged",
        method: "Illustrative dissent record",
        evidenceDate: "Demonstration cycle 08",
        limitation: "The fictional condition has no assigned review owner.",
        owner: "Risk function",
      },
      {
        id: "RV–05",
        title: "Review-route schedule",
        status: "review-due",
        method: "Demonstration checkpoint plan",
        evidenceDate: "Demonstration cycle 07",
        limitation: "Dates and roles are interface content, not an operating process.",
        owner: "Governance office",
      },
    ],
  },
] as const;

const FILTERS: readonly Readonly<{ id: EvidenceFilter; label: string }>[] = [
  { id: "all", label: "All records" },
  { id: "current", label: "Current" },
  { id: "review-due", label: "Review due" },
  { id: "challenged", label: "Challenged" },
] as const;

const STATUS_LABELS: Record<EvidenceStatus, string> = {
  current: "Current",
  "review-due": "Review due",
  challenged: "Challenged",
};

function getCase(caseId: CaseId) {
  return FINANCE_CASES.find((item) => item.id === caseId) ?? FINANCE_CASES[0];
}

function getScenario(financeCase: FinanceCase, scenarioId: ScenarioId) {
  return financeCase.scenarios.find((item) => item.id === scenarioId) ?? financeCase.scenarios[0];
}

function getGovernanceEvent(financeCase: FinanceCase, eventId: string) {
  return financeCase.governance.find((item) => item.id === eventId) ?? financeCase.governance[0];
}

function getEvidenceRecord(financeCase: FinanceCase, evidenceId: string) {
  return financeCase.evidence.find((item) => item.id === evidenceId) ?? financeCase.evidence[0];
}

export function FinanceExperience({ showcase }: FinanceExperienceProps) {
  const instanceId = useId();
  const chartTitleId = `${instanceId}-scenario-title`;
  const chartDescriptionId = `${instanceId}-scenario-description`;
  const [caseId, setCaseId] = useState<CaseId>(FINANCE_CASES[0].id);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("base");
  const [guardrails, setGuardrails] = useState<Record<GuardrailId, boolean>>({
    ...FINANCE_CASES[0].guardrailDefaults,
  });
  const [governanceEventId, setGovernanceEventId] = useState(
    FINANCE_CASES[0].governance[0].id,
  );
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const [evidenceId, setEvidenceId] = useState(FINANCE_CASES[0].evidence[0].id);

  const financeCase = getCase(caseId);
  const scenario = getScenario(financeCase, scenarioId);
  const governanceEvent = getGovernanceEvent(financeCase, governanceEventId);
  const selectedEvidence = getEvidenceRecord(financeCase, evidenceId);
  const filteredEvidence = financeCase.evidence.filter(
    (item) => evidenceFilter === "all" || item.status === evidenceFilter,
  );
  const resolvedGuardrails = GUARDRAILS.filter((item) => guardrails[item.id]).length;
  const unresolvedGuardrails = GUARDRAILS.length - resolvedGuardrails;
  const readyForReview = unresolvedGuardrails === 0;
  const chartPoints = financeCase.scenarios
    .map((item, index) => `${50 + index * 130},${146 - item.index * 1.08}`)
    .join(" ");

  function selectCase(nextCaseId: CaseId) {
    const nextCase = getCase(nextCaseId);
    setCaseId(nextCaseId);
    setScenarioId("base");
    setGuardrails({ ...nextCase.guardrailDefaults });
    setGovernanceEventId(nextCase.governance[0].id);
    setEvidenceFilter("all");
    setEvidenceId(nextCase.evidence[0].id);
  }

  function selectEvidenceFilter(nextFilter: EvidenceFilter) {
    const firstMatch = financeCase.evidence.find(
      (item) => nextFilter === "all" || item.status === nextFilter,
    );
    setEvidenceFilter(nextFilter);
    if (firstMatch) setEvidenceId(firstMatch.id);
  }

  return (
    <div className={styles.root} data-showcase-sector="finance">
      <div className={styles.conceptBar}>
        <Link href="/create">
          <ArrowLeft aria-hidden="true" />
          <span>What we create</span>
        </Link>
        <p>Fictional concept website · Synthetic information · Not financial advice</p>
        <span>{showcase.sector}</span>
      </div>

      <header className={styles.masthead}>
        <Link className={styles.identity} href="#finance-overview">
          <Landmark aria-hidden="true" />
          <span>
            <strong>Meridian</strong>
            <small>Financial Office / Concept</small>
          </span>
        </Link>
        <nav aria-label="Meridian concept navigation">
          <a href="#finance-file">Decision file</a>
          <a href="#finance-scenario">Scenario desk</a>
          <a href="#finance-governance">Governance</a>
          <a href="#finance-evidence">Evidence</a>
        </nav>
      </header>

      <main>
        <section className={styles.hero} id="finance-overview" aria-labelledby="finance-heading">
          <figure className={styles.heroPhoto}>
            <Image
              alt="Architectural plans, material samples, and a physical model arranged for review"
              fill
              priority
              sizes="100vw"
              src="/create/meridian-decision-room.webp"
            />
            <figcaption>
              Contextual documentary photograph · No affiliation or represented transaction
            </figcaption>
          </figure>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Mandate · Evidence · Stewardship</p>
            <h1 id="finance-heading">Keep assumptions, evidence, and review history with each decision.</h1>
            <p className={styles.heroOverview}>{showcase.overview}</p>
            <p className={styles.disclaimerLine}>
              <ShieldCheck aria-hidden="true" />
              All files, figures, organizations, and scenarios below are synthetic interface
              content. Nothing shown is advice, a forecast, or a financial outcome.
            </p>
          </div>

          <aside className={styles.heroFolio} aria-label={`Selected fictional file ${financeCase.record}`}>
            <div className={styles.folioBinding} aria-hidden="true" />
            <div className={styles.folioHeader}>
              <span>Living decision file</span>
              <span>Demonstration / 01</span>
            </div>
            <strong className={styles.folioRecord}>{financeCase.record}</strong>
            <p className={styles.folioQuestion}>{financeCase.question}</p>
            <div className={styles.folioScenarioSwitch} aria-label="Choose a synthetic hero scenario">
              {financeCase.scenarios.map((item) => (
                <button
                  aria-pressed={item.id === scenarioId}
                  key={item.id}
                  onClick={() => setScenarioId(item.id)}
                  type="button"
                >
                  <span>{item.label}</span>
                  <strong>{item.index}</strong>
                </button>
              ))}
            </div>
            <dl className={styles.folioMetadata}>
              <div>
                <dt>Current scenario</dt>
                <dd>{scenario.label}</dd>
              </div>
              <div>
                <dt>Review state</dt>
                <dd>{readyForReview ? "Ready for fictional review" : `${unresolvedGuardrails} guardrail open`}</dd>
              </div>
              <div>
                <dt>Advice status</dt>
                <dd>None provided</dd>
              </div>
            </dl>
          </aside>

          <fieldset className={styles.caseSelector} id="finance-file">
            <legend>Open a fictional decision file</legend>
            <div className={styles.caseOptions}>
              {FINANCE_CASES.map((item) => (
                <label className={styles.caseOption} key={item.id}>
                  <input
                    checked={caseId === item.id}
                    className={styles.optionInput}
                    name={`${instanceId}-case`}
                    onChange={() => selectCase(item.id)}
                    type="radio"
                    value={item.id}
                  />
                  <span className={styles.caseOptionBody}>
                    <span>{item.record}</span>
                    <strong>{item.shortLabel}</strong>
                    <small>{item.summary}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className={styles.scenarioSection} id="finance-scenario" aria-labelledby="scenario-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>02 / Scenario desk</p>
              <h2 id="scenario-heading">Change the assumptions. Keep the limits attached.</h2>
            </div>
            <p>
              Fixed presets make the information architecture inspectable without pretending
              this fictional interface is a validated model.
            </p>
          </div>

          <div className={styles.scenarioWorkspace}>
            <fieldset className={styles.scenarioControls}>
              <legend>Choose a synthetic scenario</legend>
              {financeCase.scenarios.map((item) => (
                <label className={styles.scenarioOption} key={item.id}>
                  <input
                    checked={scenarioId === item.id}
                    className={styles.optionInput}
                    name={`${instanceId}-scenario`}
                    onChange={() => setScenarioId(item.id)}
                    type="radio"
                    value={item.id}
                  />
                  <span className={styles.scenarioOptionBody}>
                    <strong>{item.label}</strong>
                    <span>{item.index}</span>
                    <small>{financeCase.indexLabel}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <figure className={styles.chartPanel}>
              <div className={styles.chartTopline}>
                <span>{financeCase.record}</span>
                <strong>{financeCase.indexLabel}</strong>
              </div>
              <svg
                aria-labelledby={`${chartTitleId} ${chartDescriptionId}`}
                className={styles.scenarioChart}
                role="img"
                viewBox="0 0 360 190"
              >
                <title id={chartTitleId}>{`${financeCase.indexLabel} across the three synthetic scenarios`}</title>
                <desc id={chartDescriptionId}>
                  {`Base is ${financeCase.scenarios[0].index}, pressure is ${financeCase.scenarios[1].index}, and severe is ${financeCase.scenarios[2].index}. The selected scenario is ${scenario.label}.`}
                </desc>
                {[38, 92, 146].map((y, index) => (
                  <g key={y}>
                    <line className={styles.chartRule} x1="38" x2="330" y1={y} y2={y} />
                    <text className={styles.chartAxisLabel} x="4" y={y + 4}>
                      {100 - index * 50}
                    </text>
                  </g>
                ))}
                <polyline className={styles.chartLine} points={chartPoints} />
                {financeCase.scenarios.map((item, index) => {
                  const x = 50 + index * 130;
                  const y = 146 - item.index * 1.08;
                  const selected = item.id === scenarioId;
                  return (
                    <g key={item.id}>
                      {selected ? <line className={styles.chartGuide} x1={x} x2={x} y1={y} y2="158" /> : null}
                      <circle
                        className={selected ? styles.chartPointSelected : styles.chartPoint}
                        cx={x}
                        cy={y}
                        r={selected ? 8 : 5}
                      />
                      <text className={styles.chartValue} textAnchor="middle" x={x} y={y - 13}>
                        {item.index}
                      </text>
                      <text className={styles.chartScenarioLabel} textAnchor="middle" x={x} y="178">
                        {item.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <figcaption>
                Synthetic interface index. It is not currency, performance, solvency, a return,
                or a forecast.
              </figcaption>
            </figure>

            <aside className={styles.scenarioReadout} aria-live="polite">
              <p className={styles.eyebrow}>Selected / {scenario.label}</p>
              <strong className={styles.readoutIndex}>{scenario.index}</strong>
              <span>{financeCase.indexLabel}</span>
              <p>{scenario.note}</p>
              <dl>
                {scenario.metrics.map((metric) => (
                  <div key={metric.label}>
                    <dt>{metric.label}</dt>
                    <dd>{metric.value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>

          <div className={styles.dataTable} role="region" aria-label="Synthetic scenario comparison" tabIndex={0}>
            <table>
              <caption>Complete data equivalent for the fictional scenario chart</caption>
              <thead>
                <tr>
                  <th scope="col">Scenario</th>
                  <th scope="col">Index</th>
                  <th scope="col">Assumption 01</th>
                  <th scope="col">Assumption 02</th>
                  <th scope="col">Assumption 03</th>
                </tr>
              </thead>
              <tbody>
                {financeCase.scenarios.map((item) => (
                  <tr data-selected={item.id === scenarioId} key={item.id}>
                    <th scope="row">{item.label}</th>
                    <td>{item.index}</td>
                    {item.metrics.map((metric) => (
                      <td key={metric.label}>
                        <span>{metric.label}</span>
                        {metric.value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.governanceSection} id="finance-governance" aria-labelledby="governance-heading">
          <div className={styles.sectionHeadingDark}>
            <div>
              <p className={styles.eyebrow}>03 / Mandate and governance</p>
              <h2 id="governance-heading">Readiness is a visible condition, not a green light.</h2>
            </div>
            <p>
              These controls demonstrate accountable review structure. They never authorize,
              recommend, or execute a financial action.
            </p>
          </div>

          <div className={styles.guardrailGrid}>
            <fieldset className={styles.guardrailControls}>
              <legend>Illustrative mandate guardrails</legend>
              {GUARDRAILS.map((item) => (
                <label className={styles.guardrail} key={item.id}>
                  <input
                    checked={guardrails[item.id]}
                    className={styles.guardrailInput}
                    onChange={(event) =>
                      setGuardrails((current) => ({ ...current, [item.id]: event.target.checked }))
                    }
                    type="checkbox"
                  />
                  <span className={styles.guardrailTrack} aria-hidden="true">
                    <span />
                  </span>
                  <span className={styles.guardrailCopy}>
                    <strong>{item.name}</strong>
                    <small>{item.description}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <aside className={styles.readinessPanel} data-ready={readyForReview}>
              <span className={styles.readinessIcon} aria-hidden="true">
                {readyForReview ? <CheckCircle2 /> : <Scale />}
              </span>
              <p className={styles.eyebrow}>Illustrative readiness marker</p>
              <h3>{readyForReview ? "Ready for fictional review" : "Review file incomplete"}</h3>
              <p aria-live="polite">
                {readyForReview
                  ? "All four demonstration guardrails are resolved. This is a process state, not an approval."
                  : `${resolvedGuardrails} of ${GUARDRAILS.length} guardrails are resolved; ${unresolvedGuardrails} remain open.`}
              </p>
              <div className={styles.readinessSteps} aria-hidden="true">
                {GUARDRAILS.map((item) => (
                  <span data-resolved={guardrails[item.id]} key={item.id} />
                ))}
              </div>
              <small>No financial decision or recommendation is produced.</small>
            </aside>
          </div>

          <div className={styles.ledgerHeading}>
            <p className={styles.eyebrow}>Governance record</p>
            <h3>Open every role, challenge, and condition.</h3>
          </div>
          <div className={styles.ledgerLayout}>
            <ol className={styles.ledgerList}>
              {financeCase.governance.map((event, index) => (
                <li key={event.id}>
                  <button
                    aria-pressed={event.id === governanceEvent.id}
                    onClick={() => setGovernanceEventId(event.id)}
                    type="button"
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{event.role}</strong>
                    <small>{event.action}</small>
                    <em>{event.state}</em>
                  </button>
                </li>
              ))}
            </ol>
            <article className={styles.ledgerDetail} aria-live="polite">
              <div>
                <span>{governanceEvent.timestamp}</span>
                <strong>{governanceEvent.state}</strong>
              </div>
              <h4>{governanceEvent.action}</h4>
              <dl>
                <div>
                  <dt>Recorded rationale</dt>
                  <dd>{governanceEvent.rationale}</dd>
                </div>
                <div>
                  <dt>Condition or boundary</dt>
                  <dd>{governanceEvent.condition}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>

        <section className={styles.evidenceSection} id="finance-evidence" aria-labelledby="evidence-heading">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>04 / Evidence register</p>
              <h2 id="evidence-heading">Analysis with its assumptions attached.</h2>
            </div>
            <p>
              Each demonstration note keeps its method, evidence cycle, responsible role, and
              limitation visible beside its review status.
            </p>
          </div>

          <div className={styles.filterBar} aria-label="Filter evidence records">
            {FILTERS.map((filter) => {
              const count =
                filter.id === "all"
                  ? financeCase.evidence.length
                  : financeCase.evidence.filter((item) => item.status === filter.id).length;
              return (
                <button
                  aria-pressed={filter.id === evidenceFilter}
                  key={filter.id}
                  onClick={() => selectEvidenceFilter(filter.id)}
                  type="button"
                >
                  <span>{filter.label}</span>
                  <small>{count}</small>
                </button>
              );
            })}
          </div>

          <div className={styles.evidenceLayout}>
            <div className={styles.evidenceTable} role="region" aria-label="Fictional evidence register" tabIndex={0}>
              <table>
                <caption>Synthetic records for information-design demonstration only</caption>
                <thead>
                  <tr>
                    <th scope="col">Record</th>
                    <th scope="col">Title</th>
                    <th scope="col">Review state</th>
                    <th scope="col">Responsible role</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvidence.map((record) => (
                    <tr data-selected={record.id === selectedEvidence.id} key={record.id}>
                      <th scope="row">
                        <button
                          aria-pressed={record.id === selectedEvidence.id}
                          onClick={() => setEvidenceId(record.id)}
                          type="button"
                        >
                          <FileText aria-hidden="true" />
                          {record.id}
                        </button>
                      </th>
                      <td>{record.title}</td>
                      <td>
                        <span className={styles.evidenceStatus} data-status={record.status}>
                          {STATUS_LABELS[record.status]}
                        </span>
                      </td>
                      <td>{record.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <article className={styles.evidenceDetail} aria-live="polite">
              <div className={styles.evidenceDetailHeader}>
                <span>{selectedEvidence.id}</span>
                <span className={styles.evidenceStatus} data-status={selectedEvidence.status}>
                  {STATUS_LABELS[selectedEvidence.status]}
                </span>
              </div>
              <h3>{selectedEvidence.title}</h3>
              <dl>
                <div>
                  <dt>Method</dt>
                  <dd>{selectedEvidence.method}</dd>
                </div>
                <div>
                  <dt>Evidence date</dt>
                  <dd>{selectedEvidence.evidenceDate}</dd>
                </div>
                <div>
                  <dt>Responsible role</dt>
                  <dd>{selectedEvidence.owner}</dd>
                </div>
                <div>
                  <dt>Limitation</dt>
                  <dd>{selectedEvidence.limitation}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>

        <section className={styles.ctaSection}>
          <p className={styles.eyebrow}>Institutional confidence begins with structure</p>
          <h2>Build a finance experience that makes judgement inspectable.</h2>
          <Link href="/contact?brief=finance-website">
            Commission an institutional finance website <ArrowUpRight aria-hidden="true" />
          </Link>
        </section>

        <aside className={styles.disclosure} aria-label="Concept disclosure">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Concept status</strong>
            <p>{showcase.disclosure}</p>
          </div>
        </aside>
      </main>
    </div>
  );
}

export default FinanceExperience;
