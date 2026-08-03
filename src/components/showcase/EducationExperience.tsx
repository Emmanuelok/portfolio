"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  BookOpenText,
  CalendarRange,
  Compass,
  FileText,
  Leaf,
  LibraryBig,
  MapPin,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { WebsiteShowcase } from "@/data/creations";

import styles from "./EducationExperience.module.css";

type EducationExperienceProps = Readonly<{
  showcase: WebsiteShowcase;
}>;

const QUESTIONS = {
  heat: {
    short: "Neighbourhood heat",
    title: "How might a neighbourhood cool itself during hotter summers?",
    context:
      "Study shade, materials, water, movement, and lived experience before proposing a place-based response.",
    field: "Climate · Place · Public life",
    evidence: "Shade observations, surface notes, route maps, resident questions",
    artifact: "A public cooling atlas and one testable street-scale intervention",
    methods: ["Thermal walk", "Material diary", "Stakeholder map", "Prototype critique"],
  },
  trust: {
    short: "Useful public information",
    title: "What would make local public information easier to trust and use?",
    context:
      "Trace how a public message is sourced, interpreted, shared, and acted on across different situations.",
    field: "Information · Trust · Civic systems",
    evidence: "Source trails, comprehension interviews, service journeys, language audits",
    artifact: "An evidence-linked public guide with a reusable clarity standard",
    methods: ["Source tracing", "Listening session", "Plain-language audit", "Usability walk-through"],
  },
  materials: {
    short: "Materials in circulation",
    title: "How can everyday materials circulate instead of becoming waste?",
    context:
      "Follow one common material through use, repair, exchange, and disposal to reveal practical leverage points.",
    field: "Materials · Systems · Stewardship",
    evidence: "Material flows, repair stories, constraint log, service touchpoints",
    artifact: "A circular-use field manual and a working exchange prototype",
    methods: ["Flow mapping", "Object interview", "Repair observation", "Service prototyping"],
  },
} as const;

const RHYTHMS = {
  intensive: {
    label: "Field intensive",
    note: "10 concentrated days",
    cadence: "Daily fieldwork, studio synthesis, and a public review at the end of each week.",
    sessions: ["Monday / Orient", "Tuesday / Observe", "Wednesday / Make", "Thursday / Test", "Friday / Share"],
  },
  studio: {
    label: "Studio semester",
    note: "8 deliberate weeks",
    cadence: "Two studio meetings and one self-directed field block each week, with fortnightly critique.",
    sessions: ["Monday / Seminar", "Tuesday / Field", "Wednesday / Studio", "Thursday / Clinic", "Friday / Commons"],
  },
  commons: {
    label: "Evening commons",
    note: "4 accessible weeks",
    cadence: "Two evening sessions each week, supported by a flexible field prompt and an open Saturday table.",
    sessions: ["Tuesday / Gather", "Wednesday / Field", "Thursday / Workshop", "Friday / Reflect", "Saturday / Open table"],
  },
} as const;

const PHASES = [
  {
    id: "notice",
    number: "01",
    label: "Notice",
    verb: "Look before naming",
    prompt: "Collect situated observations without forcing an early answer.",
    output: "Field record",
    resources: ["Observation protocol", "Consent-aware conversation guide", "Field-note template"],
    dayActions: ["Orient to the question", "Walk and observe", "Sort what was noticed", "Check blind spots", "Share an open question"],
  },
  {
    id: "frame",
    number: "02",
    label: "Frame",
    verb: "Make the system visible",
    prompt: "Connect people, places, incentives, constraints, and unanswered questions.",
    output: "Shared system map",
    resources: ["Stakeholder map", "Assumption register", "Evidence-and-gap canvas"],
    dayActions: ["Name the system boundary", "Trace relationships", "Map tensions", "Challenge assumptions", "Publish the working frame"],
  },
  {
    id: "build",
    number: "03",
    label: "Build",
    verb: "Give the idea a form",
    prompt: "Turn one promising hypothesis into the smallest useful thing people can encounter.",
    output: "Working proposition",
    resources: ["Prototype ladder", "Materials plan", "Decision log"],
    dayActions: ["Choose a leverage point", "Sketch alternatives", "Build at full intent", "Invite an early encounter", "Document the proposition"],
  },
  {
    id: "test",
    number: "04",
    label: "Test",
    verb: "Learn from contact",
    prompt: "Place the proposition in context and look for evidence that changes the next decision.",
    output: "Learning report",
    resources: ["Test plan", "Feedback capture", "Limitations note"],
    dayActions: ["Define a learning question", "Prepare the encounter", "Observe without defending", "Interpret with caution", "Decide what changes"],
  },
  {
    id: "publish",
    number: "05",
    label: "Publish",
    verb: "Return knowledge to public use",
    prompt: "Make the work understandable, inspectable, and reusable beyond the studio.",
    output: "Public artifact",
    resources: ["Source-note standard", "Accessibility review", "Public handover checklist"],
    dayActions: ["Identify the audience", "Edit for clarity", "Expose sources and limits", "Host a public review", "Release and invite response"],
  },
] as const;

type QuestionKey = keyof typeof QUESTIONS;
type RhythmKey = keyof typeof RHYTHMS;
type PhaseId = (typeof PHASES)[number]["id"];
const QUESTION_KEYS = Object.keys(QUESTIONS) as QuestionKey[];

const SHELF = [
  {
    category: "Field methods",
    title: "Notice without extracting",
    description: "A demonstration note on observation, permission, and responsible field records.",
    format: "Method note · 7 min",
  },
  {
    category: "Field methods",
    title: "A walk is a research instrument",
    description: "Prompts for reading movement, access, materials, and informal knowledge in place.",
    format: "Field guide · 12 min",
  },
  {
    category: "Facilitation",
    title: "Build the question together",
    description: "A compact structure for turning different experiences into a shared inquiry.",
    format: "Workshop score · 45 min",
  },
  {
    category: "Facilitation",
    title: "Critique that moves the work",
    description: "Separate preference, observation, interpretation, and useful next decisions.",
    format: "Studio protocol · 9 min",
  },
  {
    category: "Making",
    title: "Prototype the relationship",
    description: "Test who does what, when, and with what evidence—not only how an object looks.",
    format: "Practice note · 8 min",
  },
  {
    category: "Making",
    title: "A ladder of useful fidelity",
    description: "Choose the lightest prototype capable of answering the current learning question.",
    format: "Reference card · 5 min",
  },
  {
    category: "Publishing",
    title: "Show the sources and the seams",
    description: "A publishing checklist for evidence, uncertainty, authorship, and reuse.",
    format: "Checklist · 6 min",
  },
  {
    category: "Publishing",
    title: "Make a public handover",
    description: "Plan how a project leaves the studio and becomes understandable to others.",
    format: "Handover score · 10 min",
  },
] as const;

const SHELF_FILTERS = ["All", "Field methods", "Facilitation", "Making", "Publishing"] as const;
type ShelfFilter = (typeof SHELF_FILTERS)[number];

export function EducationExperience({ showcase }: EducationExperienceProps) {
  const [questionKey, setQuestionKey] = useState<QuestionKey>("heat");
  const [rhythmKey, setRhythmKey] = useState<RhythmKey>("studio");
  const [phaseId, setPhaseId] = useState<PhaseId>("notice");
  const [selectedDay, setSelectedDay] = useState(0);
  const [shelfFilter, setShelfFilter] = useState<ShelfFilter>("All");

  const question = QUESTIONS[questionKey];
  const rhythm = RHYTHMS[rhythmKey];
  const phase = PHASES.find((item) => item.id === phaseId) ?? PHASES[0];
  const selectedSession = rhythm.sessions[selectedDay] ?? rhythm.sessions[0];
  const selectedAction = phase.dayActions[selectedDay] ?? phase.dayActions[0];

  const visibleShelf = useMemo(
    () =>
      shelfFilter === "All"
        ? SHELF
        : SHELF.filter((item) => item.category === shelfFilter),
    [shelfFilter],
  );

  return (
    <div className={styles.site} data-showcase-sector="education">
      <div className={styles.conceptBar}>
        <Link href="/create">
          <ArrowLeft aria-hidden="true" />
          What we create
        </Link>
        <p>Fictional concept website · Demonstration content</p>
        <span>Education / Living curriculum</span>
      </div>

      <header className={styles.header}>
        <a className={styles.identity} href="#education-overview" aria-label={`${showcase.name}, home`}>
          <span className={styles.identityMark} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            <strong>{showcase.name}</strong>
            <small>A fictional learning institution</small>
          </span>
        </a>
        <nav aria-label="Commonfield concept navigation">
          <a href="#curriculum-composer">Curriculum</a>
          <a href="#studio-week">Studio week</a>
          <a href="#knowledge-shelf">Knowledge shelf</a>
          <a href="#education-contact">Collaborate</a>
        </nav>
      </header>

      <main>
        <section className={styles.hero} id="education-overview">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Learning in public · Practice with consequence</p>
            <h1>A curriculum that starts with a real question.</h1>
            <p className={styles.heroIntro}>
              Commonfield is imagined as a learning commons where inquiry moves
              between fieldwork, studio practice, critique, and useful public
              artifacts. The interface lets the curriculum respond before your eyes.
            </p>
            <div className={styles.heroActions}>
              <a href="#curriculum-composer">Compose a learning path</a>
              <a href="#knowledge-shelf">Browse public knowledge</a>
            </div>
          </div>

          <figure className={styles.heroInstrument} data-question={questionKey}>
            <Image
              alt="A design practitioner working with a physical architectural model in a daylight studio"
              fill
              priority
              sizes="(max-width: 820px) 100vw, 56vw"
              src="/create/commonfield-workshop.webp"
            />
            <div className={styles.heroImageShade} aria-hidden="true" />
            <figcaption>
              Contextual documentary photograph · No institutional affiliation implied
            </figcaption>
            <div className={styles.heroQuestionSelector} aria-label="Choose the current public question" role="group">
              {QUESTION_KEYS.map((key, index) => (
                <button
                  aria-controls="curriculum-output"
                  aria-pressed={questionKey === key}
                  key={key}
                  onClick={() => setQuestionKey(key)}
                  type="button"
                >
                  <span>0{index + 1}</span>
                  {QUESTIONS[key].short}
                </button>
              ))}
            </div>
            <div className={styles.heroQuestion}>
              <span>Current public question</span>
              <strong>{question.title}</strong>
              <small>{question.field}</small>
            </div>
          </figure>
        </section>

        <section className={styles.composer} id="curriculum-composer" aria-labelledby="composer-heading">
          <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
            Curriculum updated: {question.title}; {rhythm.label}; {phase.label} phase. Output: {phase.output}. Current session: {selectedSession}.
          </p>
          <div className={styles.sectionIntro}>
            <p>Curriculum instrument / Interactive demonstration</p>
            <h2 id="composer-heading">Build a learning journey around what matters.</h2>
            <span>
              Choose a question, a rhythm, and the current phase. The pathway,
              studio week, methods, and public brief update as one system.
            </span>
          </div>

          <div className={styles.composerBoard}>
            <div className={styles.controlPanel}>
              <fieldset>
                <legend><span>01</span> Choose a public question</legend>
                <div className={styles.questionChoices}>
                  {QUESTION_KEYS.map((key) => (
                    <button
                      aria-controls="curriculum-output"
                      key={key}
                      type="button"
                      aria-pressed={questionKey === key}
                      onClick={() => setQuestionKey(key)}
                    >
                      <span>{QUESTIONS[key].field}</span>
                      <strong>{QUESTIONS[key].short}</strong>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend><span>02</span> Set the learning rhythm</legend>
                <div className={styles.rhythmChoices}>
                  {(Object.keys(RHYTHMS) as RhythmKey[]).map((key) => (
                    <button
                      aria-controls="curriculum-output"
                      key={key}
                      type="button"
                      aria-pressed={rhythmKey === key}
                      onClick={() => {
                        setRhythmKey(key);
                        setSelectedDay(0);
                      }}
                    >
                      <strong>{RHYTHMS[key].label}</strong>
                      <span>{RHYTHMS[key].note}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend><span>03</span> Move through the inquiry</legend>
                <div className={styles.phaseChoices}>
                  {PHASES.map((item) => (
                    <button
                      aria-controls="curriculum-output"
                      key={item.id}
                      type="button"
                      aria-pressed={phaseId === item.id}
                      onClick={() => setPhaseId(item.id)}
                    >
                      <span>{item.number}</span>
                      <strong>{item.label}</strong>
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className={styles.livePathway} id="curriculum-output">
              <div className={styles.pathwayHeader}>
                <span>Living pathway / {rhythm.note}</span>
                <strong>{phase.verb}</strong>
              </div>

              <div className={styles.pathwayMap}>
                <div className={styles.pathwayLine} aria-hidden="true" />
                {PHASES.map((item) => (
                  <button
                    aria-controls="curriculum-output"
                    key={item.id}
                    type="button"
                    className={phaseId === item.id ? styles.pathwayActive : undefined}
                    aria-label={`Open ${item.label} phase`}
                    aria-pressed={phaseId === item.id}
                    onClick={() => setPhaseId(item.id)}
                  >
                    <span>{item.number}</span>
                    <strong>{item.label}</strong>
                    <small>{item.output}</small>
                  </button>
                ))}
              </div>

              <div className={styles.pathwayReading}>
                <div>
                  <span>Question</span>
                  <h3>{question.title}</h3>
                  <p>{question.context}</p>
                </div>
                <div className={styles.phaseNote}>
                  <span>Now / {phase.label}</span>
                  <p>{phase.prompt}</p>
                  <strong>Working output: {phase.output}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.studioWeek} id="studio-week" aria-labelledby="studio-week-heading">
          <div className={styles.sectionIntroCompact}>
            <p>Studio week / {rhythm.label}</p>
            <h2 id="studio-week-heading">A week with a reason for every gathering.</h2>
          </div>

          <div className={styles.weekGrid}>
            <div className={styles.weekSchedule} role="group" aria-label="Select a studio day">
              {rhythm.sessions.map((session, index) => {
                const [day, activity] = session.split(" / ");
                return (
                  <button
                    aria-controls="studio-day-detail"
                    key={session}
                    type="button"
                    aria-pressed={selectedDay === index}
                    onClick={() => setSelectedDay(index)}
                  >
                    <span>0{index + 1}</span>
                    <strong>{day}</strong>
                    <small>{activity}</small>
                  </button>
                );
              })}
            </div>

            <article className={styles.dayDetail} id="studio-day-detail">
              <div className={styles.dayDetailTopline}>
                <CalendarRange aria-hidden="true" />
                <span>{selectedSession}</span>
              </div>
              <p className={styles.dayAction}>{selectedAction}</p>
              <dl>
                <div>
                  <dt>Field material</dt>
                  <dd>{question.evidence}</dd>
                </div>
                <div>
                  <dt>Studio purpose</dt>
                  <dd>{phase.prompt}</dd>
                </div>
                <div>
                  <dt>Rhythm</dt>
                  <dd>{rhythm.cadence}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>

        <section className={styles.projectLab} aria-labelledby="project-lab-heading">
          <div className={styles.projectBrief}>
            <div className={styles.briefHeading}>
              <span>CF / Generated studio brief</span>
              <FileText aria-hidden="true" />
            </div>
            <p className={styles.briefLabel}>Public question</p>
            <h2 id="project-lab-heading">{question.title}</h2>
            <div className={styles.briefGrid}>
              <div>
                <span>Context</span>
                <p>{question.context}</p>
              </div>
              <div>
                <span>Learning rhythm</span>
                <p>{rhythm.label} · {rhythm.note}. {rhythm.cadence}</p>
              </div>
              <div>
                <span>Current work</span>
                <p>{phase.label}: {phase.prompt}</p>
              </div>
              <div>
                <span>Public artifact</span>
                <p>{question.artifact}</p>
              </div>
            </div>
            <p className={styles.syntheticNote}>
              <Sparkles aria-hidden="true" />
              This brief is assembled from synthetic demonstration content. It is not a real course or learner record.
            </p>
          </div>

          <aside className={styles.methodKit} aria-label="Methods and studio resources">
            <div>
              <Compass aria-hidden="true" />
              <span>Methods for this question</span>
            </div>
            <ol>
              {question.methods.map((method, index) => (
                <li key={method}><span>0{index + 1}</span>{method}</li>
              ))}
            </ol>
            <div>
              <BookOpenText aria-hidden="true" />
              <span>Resources for {phase.label}</span>
            </div>
            <ol>
              {phase.resources.map((resource, index) => (
                <li key={resource}><span>R{index + 1}</span>{resource}</li>
              ))}
            </ol>
          </aside>
        </section>

        <section className={styles.knowledgeShelf} id="knowledge-shelf" aria-labelledby="knowledge-heading">
          <div className={styles.sectionIntro}>
            <p>Public knowledge shelf / Demonstration catalogue</p>
            <h2 id="knowledge-heading">Keep useful methods in circulation.</h2>
            <span>
              The shelf turns institutional knowledge into practical public
              resources. Titles and metadata below are fictional interface content.
            </span>
          </div>

          <div className={styles.shelfFilters} role="group" aria-label="Filter knowledge shelf">
            {SHELF_FILTERS.map((filter) => (
              <button
                aria-controls="knowledge-results"
                key={filter}
                type="button"
                aria-pressed={shelfFilter === filter}
                onClick={() => setShelfFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          <p className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
            Showing {visibleShelf.length} {shelfFilter === "All" ? "demonstration resources" : `${shelfFilter.toLowerCase()} resources`}.
          </p>
          <div className={styles.shelfGrid} id="knowledge-results">
            {visibleShelf.map((item, index) => (
              <article key={item.title}>
                <div>
                  {index % 3 === 0 ? <Leaf aria-hidden="true" /> : null}
                  {index % 3 === 1 ? <MapPin aria-hidden="true" /> : null}
                  {index % 3 === 2 ? <LibraryBig aria-hidden="true" /> : null}
                  <span>{item.category}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <small>{item.format}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.contact} id="education-contact">
          <div>
            <p>For schools, learning organizations, and public knowledge programmes</p>
            <h2>Build an institution people can understand, use, and learn with.</h2>
          </div>
          <Link href="/contact?brief=education-website">
            Commission an education platform <ArrowUpRight aria-hidden="true" />
          </Link>
        </section>

        <aside className={styles.disclosure} aria-label="Concept disclosure">
          <span>Concept status / Fictional demonstration</span>
          <p>{showcase.disclosure}</p>
        </aside>
      </main>
    </div>
  );
}

export default EducationExperience;
