"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Gauge,
  Microscope,
  Network,
  RotateCcw,
  ShieldCheck,
  Waves,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import type { WebsiteShowcase } from "@/data/creations";

import styles from "./ScienceExperience.module.css";

const HERO_IMAGE_URL = "/create/lumen-vale-documentary.webp";

type ScienceExperienceProps = Readonly<{
  showcase: WebsiteShowcase;
}>;

type SampleRecord = Readonly<{
  id: string;
  shortName: string;
  material: string;
  method: string;
  protocol: string;
  review: string;
  reviewTone: "ready" | "review" | "limited";
  observation: string;
  limitation: string;
  trace: string;
  peak: string;
  points: readonly Readonly<{ cx: number; cy: number; r: number; opacity: number }>[];
}>;

const samples: readonly SampleRecord[] = [
  {
    id: "LV-SYN-014",
    shortName: "Porous ceramic reference",
    material: "Manufactured calibration surrogate",
    method: "Optical surface mapping",
    protocol: "MTH-OPT-04 · revision 2.1",
    review: "Method check complete",
    reviewTone: "ready",
    observation:
      "The display is configured to demonstrate how a surface-intensity record can be inspected alongside its method context.",
    limitation:
      "Synthetic values only. No composition, performance, or material-property conclusion can be drawn from this interface state.",
    trace: "0,124 34,118 67,121 100,98 134,106 167,72 201,78 234,52 268,86 301,69 335,94 368,88 402,112 435,105 468,117 500,113",
    peak: "Illustrative band / 612 a.u.",
    points: [
      { cx: 21, cy: 26, r: 6, opacity: 0.72 },
      { cx: 42, cy: 54, r: 10, opacity: 0.5 },
      { cx: 64, cy: 33, r: 5, opacity: 0.8 },
      { cx: 75, cy: 68, r: 12, opacity: 0.38 },
      { cx: 30, cy: 76, r: 8, opacity: 0.6 },
      { cx: 87, cy: 22, r: 4, opacity: 0.85 },
      { cx: 56, cy: 84, r: 4, opacity: 0.7 },
    ],
  },
  {
    id: "LV-SYN-021",
    shortName: "Polymer film control",
    material: "Uniform optical reference film",
    method: "Transmission profile scan",
    protocol: "MTH-TRN-02 · revision 1.8",
    review: "Secondary review pending",
    reviewTone: "review",
    observation:
      "This state demonstrates how a broad transmission profile and local variation could be surfaced for review without claiming interpretation.",
    limitation:
      "The curve is intentionally simulated. Instrument response, uncertainty, and environmental conditions are not represented.",
    trace: "0,119 34,115 67,109 100,96 134,72 167,58 201,66 234,42 268,47 301,78 335,83 368,98 402,94 435,108 468,105 500,111",
    peak: "Illustrative band / 474 a.u.",
    points: [
      { cx: 18, cy: 48, r: 12, opacity: 0.28 },
      { cx: 39, cy: 42, r: 9, opacity: 0.36 },
      { cx: 61, cy: 49, r: 13, opacity: 0.24 },
      { cx: 82, cy: 43, r: 9, opacity: 0.34 },
      { cx: 28, cy: 69, r: 5, opacity: 0.62 },
      { cx: 53, cy: 70, r: 6, opacity: 0.58 },
      { cx: 76, cy: 68, r: 5, opacity: 0.65 },
    ],
  },
  {
    id: "LV-SYN-033",
    shortName: "Mineral composite control",
    material: "Multi-phase imaging surrogate",
    method: "Reflectance comparison",
    protocol: "MTH-REF-09 · draft 0.6",
    review: "Protocol boundary unresolved",
    reviewTone: "limited",
    observation:
      "The interface exposes a deliberately uneven field to show how an unresolved protocol state can remain visible during inspection.",
    limitation:
      "Draft method. The simulated pattern is not suitable for comparison, classification, or inference of any kind.",
    trace: "0,116 34,106 67,112 100,79 134,91 167,41 201,88 234,65 268,102 301,52 335,63 368,44 402,92 435,70 468,115 500,108",
    peak: "Illustrative band / not validated",
    points: [
      { cx: 16, cy: 22, r: 9, opacity: 0.48 },
      { cx: 36, cy: 38, r: 4, opacity: 0.78 },
      { cx: 59, cy: 26, r: 13, opacity: 0.3 },
      { cx: 78, cy: 52, r: 7, opacity: 0.65 },
      { cx: 21, cy: 72, r: 13, opacity: 0.3 },
      { cx: 51, cy: 66, r: 8, opacity: 0.58 },
      { cx: 70, cy: 82, r: 4, opacity: 0.8 },
      { cx: 89, cy: 20, r: 5, opacity: 0.72 },
    ],
  },
] as const;

const lineage = [
  {
    id: "question",
    index: "01",
    title: "Question",
    status: "Scoped",
    detail:
      "The demonstration question defines what the synthetic observation view should make inspectable. It does not assert a scientific hypothesis.",
    owner: "Programme lead",
    version: "Q-04 / v1.2",
  },
  {
    id: "protocol",
    index: "02",
    title: "Protocol",
    status: "Versioned",
    detail:
      "Preparation, instrument conditions, controls, and exclusions are represented as a versioned method record.",
    owner: "Methods group",
    version: "MTH-OPT-04 / v2.1",
  },
  {
    id: "calibration",
    index: "03",
    title: "Calibration",
    status: "Attached",
    detail:
      "A synthetic reference record is linked before the observation state so provenance remains visible at the point of use.",
    owner: "Facility team",
    version: "CAL-118 / demo",
  },
  {
    id: "observation",
    index: "04",
    title: "Observation",
    status: "Preserved",
    detail:
      "The un-interpreted demonstration record is preserved separately from commentary and later review notes.",
    owner: "Research operator",
    version: "OBS-014 / synthetic",
  },
  {
    id: "review",
    index: "05",
    title: "Review",
    status: "Bounded",
    detail:
      "Review records alternative explanations, missing controls, and reuse limits rather than converting uncertainty into a claim.",
    owner: "Independent reviewer",
    version: "REV-07 / illustrative",
  },
] as const;

const instruments = [
  {
    id: "LV-OPT-07",
    name: "Optical profilometer",
    purpose: "Non-contact surface profile demonstration",
    readiness: "Method conversation available",
    requirements: "Sample dimensions, surface condition, intended comparison, and handling constraints.",
  },
  {
    id: "LV-RMN-03",
    name: "Raman microscope",
    purpose: "Illustrative spectral workflow planning",
    readiness: "Specialist review required",
    requirements: "Material declaration, proposed settings, reference approach, and responsible-use review.",
  },
  {
    id: "LV-ENV-11",
    name: "Environmental chamber",
    purpose: "Controlled-condition protocol planning",
    readiness: "Preparation check required",
    requirements: "Condition range, monitoring plan, sample compatibility, duration, and data-stewardship needs.",
  },
] as const;

const accessModes = [
  {
    id: "collaborative",
    title: "Collaborative method review",
    description: "Shape the question, preparation record, and access pathway with a facility specialist.",
  },
  {
    id: "prepared",
    title: "Prepared protocol review",
    description: "Bring an existing method draft for compatibility, safety, and stewardship review.",
  },
] as const;

function ReviewMark({ tone }: Readonly<{ tone: SampleRecord["reviewTone"] }>) {
  const labels = {
    ready: "review complete",
    review: "review pending",
    limited: "method limitation",
  } as const;

  return (
    <span className={styles.reviewMark} data-tone={tone}>
      <span aria-hidden="true" />
      {labels[tone]}
    </span>
  );
}

function SampleObservation({ sample }: Readonly<{ sample: SampleRecord }>) {
  return (
    <div className={styles.observationSurface}>
      <div className={styles.observationToolbar}>
        <span>Observation field</span>
        <span>Source / synthetic</span>
        <span>Scale / illustrative</span>
      </div>
      <svg
        className={styles.fieldMap}
        viewBox="0 0 100 100"
        role="img"
        aria-labelledby={`field-title-${sample.id} field-description-${sample.id}`}
      >
        <title id={`field-title-${sample.id}`}>{`${sample.shortName} synthetic observation field`}</title>
        <desc id={`field-description-${sample.id}`}>
          An abstract, simulated intensity field used only to demonstrate an inspectable research interface.
        </desc>
        <rect className={styles.fieldBase} x="0" y="0" width="100" height="100" />
        <g className={styles.fieldGrid} aria-hidden="true">
          {[20, 40, 60, 80].map((position) => (
            <g key={position}>
              <line x1={position} y1="0" x2={position} y2="100" />
              <line x1="0" y1={position} x2="100" y2={position} />
            </g>
          ))}
        </g>
        <path className={styles.fieldContour} d="M5 62 C18 36 29 76 45 50 S74 26 95 56" />
        <path className={styles.fieldContourSecondary} d="M4 78 C22 58 37 88 55 67 S81 48 96 71" />
        <g className={styles.fieldPoints}>
          {sample.points.map((point, index) => (
            <circle
              key={`${sample.id}-${index}`}
              cx={point.cx}
              cy={point.cy}
              r={point.r}
              opacity={point.opacity}
            />
          ))}
        </g>
        <g className={styles.crosshair} aria-hidden="true">
          <line x1="49" y1="38" x2="49" y2="62" />
          <line x1="37" y1="50" x2="61" y2="50" />
          <circle cx="49" cy="50" r="9" />
        </g>
      </svg>
      <div className={styles.fieldReadout}>
        <span>Record</span>
        <strong>{sample.id}</strong>
        <span>Display state</span>
        <strong>Uninterpreted</strong>
      </div>
    </div>
  );
}

function SpectralTrace({ sample }: Readonly<{ sample: SampleRecord }>) {
  return (
    <figure className={styles.traceFigure}>
      <div className={styles.traceHeading}>
        <div>
          <Waves aria-hidden="true" />
          <span>Illustrative signal profile</span>
        </div>
        <strong>{sample.peak}</strong>
      </div>
      <svg viewBox="0 0 500 140" role="img" aria-label={`Synthetic signal trace for ${sample.id}`}>
        <g className={styles.traceGrid} aria-hidden="true">
          <line x1="0" y1="35" x2="500" y2="35" />
          <line x1="0" y1="70" x2="500" y2="70" />
          <line x1="0" y1="105" x2="500" y2="105" />
        </g>
        <polyline className={styles.traceShadow} points={sample.trace} />
        <polyline className={styles.traceLine} points={sample.trace} />
      </svg>
      <figcaption>Normalized interface units · simulated for interaction design only</figcaption>
    </figure>
  );
}

function ResearchObservatory() {
  const [activeSampleIndex, setActiveSampleIndex] = useState(0);
  const sampleTabs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeSample = samples[activeSampleIndex];

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % samples.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + samples.length) % samples.length;
    }
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = samples.length - 1;
    else return;

    event.preventDefault();
    setActiveSampleIndex(nextIndex);
    sampleTabs.current[nextIndex]?.focus();
  };

  return (
    <section className={styles.observatory} id="observatory" aria-labelledby="observatory-heading">
      <div className={styles.sectionIntro}>
        <div>
          <p className={styles.kicker}>Research observatory / Interactive demonstration</p>
          <h2 id="observatory-heading">Inspect the record before the interpretation.</h2>
        </div>
        <p>
          Select a synthetic sample record. Its observation field, signal trace,
          protocol, review state, and limitations change together—preserving the
          context a credible scientific interface should never hide.
        </p>
      </div>

      <div className={styles.observatoryShell}>
        <div className={styles.sampleRail} role="tablist" aria-label="Synthetic sample records">
          <div className={styles.sampleRailHeading}>
            <span>Sample register</span>
            <strong>{String(samples.length).padStart(2, "0")} records</strong>
          </div>
          {samples.map((sample, index) => (
            <button
              className={styles.sampleTab}
              data-active={activeSampleIndex === index}
              id={`sample-tab-${sample.id}`}
              key={sample.id}
              onClick={() => setActiveSampleIndex(index)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(node) => {
                sampleTabs.current[index] = node;
              }}
              role="tab"
              aria-controls={`sample-panel-${sample.id}`}
              aria-selected={activeSampleIndex === index}
              tabIndex={activeSampleIndex === index ? 0 : -1}
              type="button"
            >
              <span>{sample.id}</span>
              <strong>{sample.shortName}</strong>
              <ReviewMark tone={sample.reviewTone} />
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
        </div>

        <div
          className={styles.sampleWorkspace}
          id={`sample-panel-${activeSample.id}`}
          role="tabpanel"
          aria-labelledby={`sample-tab-${activeSample.id}`}
          tabIndex={0}
        >
          <SampleObservation sample={activeSample} />
          <div className={styles.evidencePanel}>
            <div className={styles.evidenceTitle}>
              <div>
                <span>Selected record</span>
                <h3>{activeSample.shortName}</h3>
              </div>
              <ReviewMark tone={activeSample.reviewTone} />
            </div>
            <dl className={styles.methodMetadata}>
              <div>
                <dt>Material class</dt>
                <dd>{activeSample.material}</dd>
              </div>
              <div>
                <dt>Method</dt>
                <dd>{activeSample.method}</dd>
              </div>
              <div>
                <dt>Protocol</dt>
                <dd>{activeSample.protocol}</dd>
              </div>
              <div>
                <dt>Review</dt>
                <dd>{activeSample.review}</dd>
              </div>
            </dl>
            <SpectralTrace sample={activeSample} />
            <div className={styles.observationNotes}>
              <div>
                <span>Observation note</span>
                <p>{activeSample.observation}</p>
              </div>
              <div className={styles.limitationNote}>
                <ShieldCheck aria-hidden="true" />
                <div>
                  <span>Limitation</span>
                  <p>{activeSample.limitation}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EvidenceLineage() {
  const [selectedNode, setSelectedNode] = useState(0);
  const activeNode = lineage[selectedNode];

  return (
    <section className={styles.lineageSection} id="lineage" aria-labelledby="lineage-heading">
      <div className={styles.sectionIntro}>
        <div>
          <p className={styles.kicker}>Evidence lineage / Select a stage</p>
          <h2 id="lineage-heading">Link each claim to its source, method, and review history.</h2>
        </div>
        <p>
          This interactive lineage is a design model: it shows how a research
          platform can preserve responsibility, versions, review, and reuse limits
          from question to publication.
        </p>
      </div>

      <div className={styles.lineageWorkspace}>
        <div className={styles.lineageGraph} role="group" aria-label="Illustrative evidence lineage stages">
          <svg viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
            <path d="M80 112 C180 112 180 54 280 54 S380 166 480 166 S580 72 680 72 S780 132 920 132" />
          </svg>
          {lineage.map((node, index) => (
            <button
              className={`${styles.lineageNode} ${styles[`lineageNode${index + 1}`]}`}
              data-active={selectedNode === index}
              key={node.id}
              onClick={() => setSelectedNode(index)}
              type="button"
              aria-pressed={selectedNode === index}
            >
              <span>{node.index}</span>
              <CircleDot aria-hidden="true" />
              <strong>{node.title}</strong>
              <small>{node.status}</small>
            </button>
          ))}
        </div>

        <div className={styles.lineageDetail} aria-live="polite">
          <div className={styles.lineageDetailIndex}>{activeNode.index}</div>
          <div>
            <span>Selected lineage record</span>
            <h3>{activeNode.title}</h3>
            <p>{activeNode.detail}</p>
          </div>
          <dl>
            <div>
              <dt>Responsible role</dt>
              <dd>{activeNode.owner}</dd>
            </div>
            <div>
              <dt>Version record</dt>
              <dd>{activeNode.version}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function InstrumentAccessDraft() {
  const [selectedInstrument, setSelectedInstrument] = useState<(typeof instruments)[number]["id"]>(instruments[0].id);
  const [selectedMode, setSelectedMode] = useState<(typeof accessModes)[number]["id"]>(accessModes[0].id);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const stepHeading = useRef<HTMLDivElement | null>(null);
  const shouldFocusStep = useRef(false);

  const instrument = instruments.find((item) => item.id === selectedInstrument) ?? instruments[0];
  const mode = accessModes.find((item) => item.id === selectedMode) ?? accessModes[0];

  useEffect(() => {
    if (!shouldFocusStep.current) return;

    stepHeading.current?.focus();
    shouldFocusStep.current = false;
  }, [step]);

  const moveToStep = (nextStep: 1 | 2 | 3) => {
    shouldFocusStep.current = true;
    setStep(nextStep);
  };

  const resetDraft = () => {
    setSelectedInstrument(instruments[0].id);
    setSelectedMode(accessModes[0].id);
    moveToStep(1);
  };

  return (
    <section className={styles.accessSection} id="access" aria-labelledby="access-heading">
      <div className={styles.accessIntro}>
        <p className={styles.kicker}>Instrument access / Guided demonstration</p>
        <h2 id="access-heading">Begin with fit, preparation, and stewardship.</h2>
        <p>
          A credible access pathway should explain constraints before asking for a
          request. This demonstration creates a local summary only—nothing is sent,
          saved, or submitted.
        </p>
        <ol className={styles.stepRail} aria-label="Draft progress">
          {["Instrument", "Access route", "Summary"].map((label, index) => {
            const position = index + 1;
            return (
              <li
                key={label}
                aria-current={step === position ? "step" : undefined}
                data-state={step === position ? "active" : step > position ? "complete" : "upcoming"}
              >
                <span>{step > position ? <Check aria-hidden="true" /> : `0${position}`}</span>
                {label}
              </li>
            );
          })}
        </ol>
      </div>

      <div className={styles.accessBuilder}>
        {step === 1 ? (
          <div className={styles.accessStep}>
            <div className={styles.accessStepHeading} ref={stepHeading} tabIndex={-1}>
              <span>Step 01</span>
              <h3>Select an illustrative facility record</h3>
              <p>No instrument availability or operating service is implied.</p>
            </div>
            <div className={styles.instrumentList} role="group" aria-label="Instrument record">
              {instruments.map((item) => (
                <button
                  key={item.id}
                  className={styles.instrumentOption}
                  data-selected={selectedInstrument === item.id}
                  onClick={() => setSelectedInstrument(item.id)}
                  aria-pressed={selectedInstrument === item.id}
                  type="button"
                >
                  <span>{item.id}</span>
                  <Microscope aria-hidden="true" />
                  <strong>{item.name}</strong>
                  <p>{item.purpose}</p>
                  <small>{item.readiness}</small>
                </button>
              ))}
            </div>
            <button className={styles.primaryControl} onClick={() => moveToStep(2)} type="button">
              Continue to access route <ArrowRight aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className={styles.accessStep}>
            <div className={styles.accessStepHeading} ref={stepHeading} tabIndex={-1}>
              <span>Step 02</span>
              <h3>Choose how the method conversation begins</h3>
              <p>Both routes require a specialist to determine fit; this interface does not approve access.</p>
            </div>
            <div className={styles.modeList} role="group" aria-label="Access review route">
              {accessModes.map((item) => (
                <button
                  key={item.id}
                  className={styles.modeOption}
                  data-selected={selectedMode === item.id}
                  onClick={() => setSelectedMode(item.id)}
                  aria-pressed={selectedMode === item.id}
                  type="button"
                >
                  <span aria-hidden="true" />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className={styles.accessControls}>
              <button className={styles.secondaryControl} onClick={() => moveToStep(1)} type="button">
                <ArrowLeft aria-hidden="true" /> Back
              </button>
              <button className={styles.primaryControl} onClick={() => moveToStep(3)} type="button">
                Prepare demo summary <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className={styles.accessSummary}>
            <div className={styles.summarySeal} aria-hidden="true">
              <FlaskConical />
            </div>
            <div className={styles.accessStepHeading} ref={stepHeading} tabIndex={-1}>
              <span>Local demonstration summary</span>
              <h3>A method conversation, not an access approval.</h3>
              <p>This summary exists only in the current page view and has not been transmitted or saved.</p>
            </div>
            <dl className={styles.summaryDetails}>
              <div><dt>Record</dt><dd>{instrument.id} · {instrument.name}</dd></div>
              <div><dt>Illustrative purpose</dt><dd>{instrument.purpose}</dd></div>
              <div><dt>Preparation context</dt><dd>{instrument.requirements}</dd></div>
              <div><dt>Review route</dt><dd>{mode.title}</dd></div>
              <div><dt>Outcome</dt><dd>Specialist fit and stewardship review would be required.</dd></div>
            </dl>
            <button className={styles.secondaryControl} onClick={resetDraft} type="button">
              <RotateCcw aria-hidden="true" /> Reset demonstration
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ScienceExperience({ showcase }: ScienceExperienceProps) {
  return (
    <div className={styles.site} data-showcase-sector="science">
      <div className={styles.conceptBar}>
        <Link href="/create">
          <ArrowLeft aria-hidden="true" />
          What we create
        </Link>
        <p>Fictional concept website · Synthetic demonstration records</p>
        <span>Scientific research</span>
      </div>

      <header className={styles.header}>
        <Link className={styles.identity} href="#overview" aria-label="Lumen Vale Laboratory concept home">
          <span aria-hidden="true">LV</span>
          <div>
            <strong>Lumen Vale</strong>
            <small>Research observatory</small>
          </div>
        </Link>
        <nav aria-label="Lumen Vale concept navigation">
          <a href="#observatory">Observatory</a>
          <a href="#lineage">Evidence lineage</a>
          <a href="#access">Instrument access</a>
        </nav>
        <a className={styles.headerAction} href="#access">
          Start a demo draft <ArrowUpRight aria-hidden="true" />
        </a>
      </header>

      <main>
        <section className={styles.hero} id="overview">
          <figure className={styles.heroMedia}>
            <Image
              alt="A laboratory researcher handling sample tubes inside a safety enclosure"
              fill
              priority
              sizes="100vw"
              src={HERO_IMAGE_URL}
            />
            <figcaption>
              Contextual documentary photograph · No affiliation, facility, or finding implied
            </figcaption>
          </figure>
          <div className={styles.heroShade} aria-hidden="true" />
          <div className={styles.heroTopline}>
            <span>Open methods / Applied science</span>
            <span>Concept environment 01—03</span>
          </div>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Lumen Vale / Interface demonstration</p>
            <h1>Evidence should arrive with its history intact.</h1>
            <p>
              A research platform concept for inspecting observation records,
              methods, limitations, review, and access pathways as one connected
              scientific system.
            </p>
            <div className={styles.heroActions}>
              <a href="#observatory">Enter the observatory <ArrowRight aria-hidden="true" /></a>
              <a href="#lineage">Trace the evidence</a>
            </div>
          </div>
          <div className={styles.heroReadouts}>
            <div><Gauge aria-hidden="true" /><span>Records</span><strong>03 synthetic states</strong></div>
            <div><Network aria-hidden="true" /><span>Lineage</span><strong>05 visible stages</strong></div>
            <div><ShieldCheck aria-hidden="true" /><span>Interpretation</span><strong>No findings claimed</strong></div>
          </div>
        </section>

        <ResearchObservatory />
        <EvidenceLineage />
        <InstrumentAccessDraft />

        <section className={styles.systemSection} aria-labelledby="system-heading">
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.kicker}>Research platform capabilities</p>
              <h2 id="system-heading">A public website can also be a trustworthy working surface.</h2>
            </div>
            <p>{showcase.thesis}</p>
          </div>
          <div className={styles.moduleGrid}>
            {showcase.interfaceModules.map((module, index) => (
              <article key={module.name}>
                <span>0{index + 1}</span>
                {index === 0 ? <Microscope aria-hidden="true" /> : index === 1 ? <CircleDot aria-hidden="true" /> : <Network aria-hidden="true" />}
                <h3>{module.name}</h3>
                <p>{module.purpose}</p>
                <small>{module.sampleContent}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.finalCta}>
          <div>
            <p className={styles.kicker}>For laboratories, programmes, and research institutions</p>
            <h2>Build the digital system the method deserves.</h2>
          </div>
          <Link href="/contact?brief=science-website">
            Commission a scientific platform <ArrowUpRight aria-hidden="true" />
          </Link>
        </section>

        <aside className={styles.disclosure} aria-label="Concept disclosure">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Fictional concept · No scientific findings</strong>
            <p>{showcase.disclosure}</p>
            <p>
              Every observation, trace, identifier, method state, facility record,
              and access outcome in this experience is synthetic and exists only to
              demonstrate interface behavior.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
