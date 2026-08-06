"use client";

import { m, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  BookOpen,
  CircleGauge,
  FlaskConical,
  Landmark,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import { websiteShowcases } from "@/data/creations";

import styles from "./CreateLaunchGallery.module.css";

type SectorKey = "science" | "finance" | "education";

const sectorOrder: readonly SectorKey[] = ["science", "finance", "education"];

const sectorMeta = {
  science: {
    label: "Scientific research",
    shortLabel: "Science",
    icon: FlaskConical,
    slug: "lumen-vale-laboratory",
    mechanism: "Evidence record",
    purpose: "Make methods, records, review, and instrument access inspectable.",
  },
  finance: {
    label: "Institutional finance",
    shortLabel: "Finance",
    icon: Landmark,
    slug: "meridian-financial-office",
    mechanism: "Decision record",
    purpose: "Keep assumptions, challenge, and decision rights attached to the work.",
  },
  education: {
    label: "Education",
    shortLabel: "Education",
    icon: BookOpen,
    slug: "commonfield-institute",
    mechanism: "Curriculum pathway",
    purpose: "Build a learning pathway around a consequential public question.",
  },
} as const;

const scienceRecords = [
  { id: "MAT–014", label: "Composite coupon A", completeness: 86, state: "Repeat condition pending" },
  { id: "ENV–031", label: "Humidity sensor B", completeness: 68, state: "Calibration review scheduled" },
  { id: "BIO–008", label: "Hydrogel surface C", completeness: 74, state: "Limitation note open" },
] as const;

const financeScenarios = [
  { id: "Base", index: 100, delay: "5 days", cost: "+2%" },
  { id: "Pressure", index: 72, delay: "30 days", cost: "+6%" },
  { id: "Severe", index: 44, delay: "60 days", cost: "+10%" },
] as const;

const educationQuestions = [
  { id: "Responsible AI", path: ["Inquiry", "Systems", "Studio", "Field", "Public brief"] },
  { id: "Climate readiness", path: ["Inquiry", "Evidence", "Field", "Studio", "Public map"] },
  { id: "Public services", path: ["Inquiry", "People", "Systems", "Prototype", "Public guide"] },
] as const;

function ScienceMiniExperience() {
  const [activeId, setActiveId] = useState<(typeof scienceRecords)[number]["id"]>("MAT–014");
  const record = scienceRecords.find((item) => item.id === activeId) ?? scienceRecords[0];

  return (
    <div className={styles.scienceDemo}>
      <div className={styles.demoStatement}>
        <span>Research records / Synthetic demonstration</span>
        <h3>Each claim is linked to its method.</h3>
        <p>Select a record to see its completeness, review status, and source trace together.</p>
      </div>
      <div className={styles.scienceConsole}>
        <div className={styles.recordSelector} aria-label="Choose a synthetic research record" role="group">
          {scienceRecords.map((item) => (
            <button
              aria-pressed={item.id === activeId}
              key={item.id}
              onClick={() => setActiveId(item.id)}
              type="button"
            >
              <span>{item.id}</span>
              <small>{item.label}</small>
            </button>
          ))}
        </div>
        <div className={styles.observationField}>
          <div className={styles.observationReadout}>
            <span>{record.id}</span>
            <strong>{record.completeness}%</strong>
            <small>record completeness</small>
          </div>
          <svg viewBox="0 0 620 250" role="img" aria-labelledby="science-trace-title science-trace-desc">
            <title id="science-trace-title">{`Illustrative source trace for ${record.id}`}</title>
            <desc id="science-trace-desc">A synthetic interface trace that changes with the selected demonstration record.</desc>
            <path className={styles.traceGrid} d="M0 42H620M0 84H620M0 126H620M0 168H620M0 210H620" />
            <path
              className={styles.traceLine}
              d={
                activeId === "MAT–014"
                  ? "M0 183C72 181 90 158 142 160S224 198 278 147 350 92 398 112 480 190 620 74"
                  : activeId === "ENV–031"
                    ? "M0 154C75 128 108 142 158 104S246 96 296 135 379 184 428 153 512 88 620 121"
                    : "M0 196C58 174 112 176 158 132S242 58 308 92 382 183 444 164 522 124 620 137"
              }
            />
          </svg>
          <div className={styles.evidenceRail}>
            {[
              ["01", "Question"],
              ["02", "Protocol"],
              ["03", "Source"],
              ["04", "Review"],
              ["05", "Method note"],
            ].map(([index, label]) => (
              <span key={index}><small>{index}</small>{label}</span>
            ))}
          </div>
          <p className={styles.stateLine}><CircleGauge aria-hidden="true" /> {record.state}</p>
        </div>
      </div>
    </div>
  );
}

function FinanceMiniExperience() {
  const [activeId, setActiveId] = useState<(typeof financeScenarios)[number]["id"]>("Base");
  const scenario = financeScenarios.find((item) => item.id === activeId) ?? financeScenarios[0];

  return (
    <div className={styles.financeDemo}>
      <div className={styles.financeFolio}>
        <span>Decision file MFO–24–07 / Demonstration only</span>
        <h3>Review assumptions, status, and decision roles together.</h3>
        <p>How resilient is an illustrative operating plan under delayed receipts and higher financing costs?</p>
        <div className={styles.guardrailList}>
          <span>Mandate aligned <b>Recorded</b></span>
          <span>Evidence currency <b>Review due</b></span>
          <span>Decision route <b>Defined</b></span>
        </div>
      </div>
      <div className={styles.scenarioDesk}>
        <div className={styles.scenarioHeader}>
          <span>Scenario comparison</span>
          <small>Synthetic fixed presets · not a forecast</small>
        </div>
        <div className={styles.scenarioButtons} aria-label="Choose an illustrative scenario" role="group">
          {financeScenarios.map((item) => (
            <button
              aria-pressed={item.id === activeId}
              key={item.id}
              onClick={() => setActiveId(item.id)}
              type="button"
            >
              {item.id}
            </button>
          ))}
        </div>
        <div className={styles.headroomScale}>
          <div className={styles.scaleLabels}><span>Reference 100</span><span>Illustrative marker 40</span></div>
          <div className={styles.scaleTrack}><span style={{ width: `${scenario.index}%` }} /></div>
          <strong>{scenario.index}</strong>
          <small>demonstration headroom index</small>
        </div>
        <dl className={styles.scenarioFacts}>
          <div><dt>Receipt delay</dt><dd>{scenario.delay}</dd></div>
          <div><dt>Operating-cost change</dt><dd>{scenario.cost}</dd></div>
          <div><dt>Review state</dt><dd>{scenario.id === "Base" ? "Evidence due" : "Challenge open"}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function EducationMiniExperience() {
  const [activeId, setActiveId] = useState<(typeof educationQuestions)[number]["id"]>("Responsible AI");
  const question = educationQuestions.find((item) => item.id === activeId) ?? educationQuestions[0];

  return (
    <div className={styles.educationDemo}>
      <div className={styles.curriculumIntro}>
        <span>Curriculum pathway / Demonstration</span>
        <h3>Choose a question to configure the curriculum.</h3>
        <div className={styles.questionButtons} aria-label="Choose a public question" role="group">
          {educationQuestions.map((item) => (
            <button
              aria-pressed={item.id === activeId}
              key={item.id}
              onClick={() => setActiveId(item.id)}
              type="button"
            >
              {item.id}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.curriculumScore} aria-live="polite">
        <div className={styles.scoreHeader}>
          <span>Current pathway</span>
          <strong>{question.id}</strong>
        </div>
        <ol>
          {question.path.map((step, index) => (
            <li key={step} style={{ "--step": index } as CSSProperties}>
              <span>0{index + 1}</span>
              <strong>{step}</strong>
              <small>{index === 4 ? "Share" : index % 2 ? "Practice" : "Frame"}</small>
            </li>
          ))}
        </ol>
        <p>Illustrative schedule · 8 hours per week</p>
      </div>
    </div>
  );
}

function ActiveExperience({ sector }: Readonly<{ sector: SectorKey }>) {
  if (sector === "science") return <ScienceMiniExperience />;
  if (sector === "finance") return <FinanceMiniExperience />;
  return <EducationMiniExperience />;
}

export function CreateLaunchGallery() {
  const [activeSector, setActiveSector] = useState<SectorKey>("science");
  const reducedMotion = useReducedMotion();
  const meta = sectorMeta[activeSector];
  const showcase = websiteShowcases.find((item) => item.slug === meta.slug);

  if (!showcase) return null;

  function moveSectorTab(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = sectorOrder.indexOf(activeSector);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? sectorOrder.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + sectorOrder.length) % sectorOrder.length;
    const nextSector = sectorOrder[nextIndex];
    setActiveSector(nextSector);
    event.currentTarget
      .querySelector<HTMLButtonElement>(`#prototype-tab-${nextSector}`)
      ?.focus();
  }

  return (
    <div className={styles.gallery} data-prototype-gallery="true" data-sector={activeSector}>
      <div className={styles.galleryHeader}>
        <div>
          <span>Interactive demonstrations / 03 sectors</span>
          <strong>{meta.label}</strong>
        </div>
        <div
          aria-label="Website demonstration sectors"
          className={styles.sectorTabs}
          onKeyDown={moveSectorTab}
          role="tablist"
        >
          {sectorOrder.map((sector, index) => {
            const item = sectorMeta[sector];
            const Icon = item.icon;
            return (
              <button
                aria-controls="active-prototype"
                aria-selected={sector === activeSector}
                id={`prototype-tab-${sector}`}
                key={sector}
                onClick={() => setActiveSector(sector)}
                role="tab"
                tabIndex={sector === activeSector ? 0 : -1}
                type="button"
              >
                <span>0{index + 1}</span>
                <Icon aria-hidden="true" />
                {item.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div
        aria-labelledby={`prototype-tab-${activeSector}`}
        className={styles.prototypeStage}
        id="active-prototype"
        role="tabpanel"
      >
        <m.div
          animate={{ opacity: 1, y: 0 }}
          className={styles.stageInner}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
          key={activeSector}
          transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <ActiveExperience sector={activeSector} />
        </m.div>
      </div>

      <div className={styles.specificationStrip}>
        <dl>
          <div><dt>Concept</dt><dd>{showcase.name}</dd></div>
          <div><dt>Key interface</dt><dd>{meta.mechanism}</dd></div>
          <div><dt>Purpose</dt><dd>{meta.purpose}</dd></div>
          <div><dt>Status</dt><dd>Fictional, interactive demonstration</dd></div>
        </dl>
        <Link href={showcase.previewHref}>
          Open the full demonstration <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
