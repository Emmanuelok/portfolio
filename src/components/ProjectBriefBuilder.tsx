"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";

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

const initialBrief: BriefState = {
  problem: "",
  affected: "",
  evidence: "",
  future: "",
  constraints: "",
  investment: "",
  horizon: "",
};

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

export function ProjectBriefBuilder() {
  const [brief, setBrief] = useState<BriefState>(initialBrief);
  const [status, setStatus] = useState("");
  const output = buildBrief(brief);

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
        <p className="eyebrow">A useful first investment</p>
        <h2 id="problem-brief-title">Make the problem legible.</h2>
        <p>
          Use this private, browser-only worksheet to turn an ambitious idea or
          institutional challenge into a clearer starting point for research,
          development, and responsible delivery.
        </p>
      </header>

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
          <p className={styles.status} aria-live="polite">{status}</p>
        </div>

        <p className={styles.privacy}>
          Privacy: this worksheet runs locally in your browser. It does not
          submit, store, or transmit the information you enter.
        </p>
      </form>
    </section>
  );
}
