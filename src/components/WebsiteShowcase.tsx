import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  Microscope,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import type { WebsiteShowcase } from "@/data/creations";

import styles from "./WebsiteShowcase.module.css";

type WebsiteShowcaseProps = Readonly<{
  showcase: WebsiteShowcase;
}>;

function ConceptBar({ showcase }: WebsiteShowcaseProps) {
  return (
    <div className={styles.conceptBar}>
      <Link href="/create">
        <ArrowLeft aria-hidden="true" />
        <span>What we create</span>
      </Link>
      <p>Fictional concept website · Demonstration content</p>
      <span>{showcase.sector}</span>
    </div>
  );
}

function ConceptDisclosure({ showcase }: WebsiteShowcaseProps) {
  return (
    <aside className={styles.disclosure} aria-label="Concept disclosure">
      <ShieldCheck aria-hidden="true" />
      <div>
        <strong>Concept status</strong>
        <p>{showcase.disclosure}</p>
      </div>
    </aside>
  );
}

function ScienceSite({ showcase }: WebsiteShowcaseProps) {
  const programmes = [
    {
      code: "R–01",
      name: "Materials systems",
      note: "Interfaces between structure, durability, and circular material use.",
      method: "Imaging · characterization · modelling",
    },
    {
      code: "R–02",
      name: "Environmental sensing",
      note: "Transparent methods for observing changing physical environments.",
      method: "Sensors · calibration · field records",
    },
    {
      code: "R–03",
      name: "Biointerfaces",
      note: "Careful inquiry into interactions between materials and living systems.",
      method: "Sample protocols · microscopy · review",
    },
  ] as const;

  const instruments = [
    ["LV–SEM–02", "Electron imaging", "Demonstration record"],
    ["LV–OPT–07", "Optical analysis", "Method review required"],
    ["LV–ENV–11", "Environmental chamber", "Illustrative availability"],
  ] as const;

  return (
    <div className={styles.scienceSite} data-showcase-sector="science">
      <ConceptBar showcase={showcase} />
      <header className={styles.sectorHeader}>
        <Link className={styles.scienceIdentity} href="#science-overview">
          <span>LV</span>
          <strong>Lumen Vale Laboratory</strong>
        </Link>
        <nav aria-label="Lumen Vale concept navigation">
          <a href="#science-research">Research</a>
          <a href="#science-methods">Methods</a>
          <a href="#science-facilities">Facilities</a>
          <a href="#science-partner">Partner</a>
        </nav>
      </header>

      <main className={styles.sectorMain}>
        <section className={styles.scienceHero} id="science-overview">
          <div className={styles.scienceHeroCopy}>
            <p className={styles.sectorEyebrow}>Open methods · Applied science</p>
            <h1>Research made inspectable.</h1>
            <p>{showcase.overview}</p>
            <div className={styles.sectorActions}>
              <a href="#science-research">Explore research</a>
              <a href="#science-partner">Propose a question</a>
            </div>
          </div>
          <figure className={styles.observationChamber}>
            <div className={styles.chamberGrid} aria-hidden="true">
              <span className={styles.chamberCore} />
              <span className={styles.chamberOrbit} />
              <span className={styles.chamberTrace} />
              <span className={styles.chamberPointOne} />
              <span className={styles.chamberPointTwo} />
              <span className={styles.chamberPointThree} />
            </div>
            <figcaption>
              Illustrative observation field · No specimen or finding represented
            </figcaption>
          </figure>
        </section>

        <section className={styles.scienceProgrammes} id="science-research" aria-labelledby="science-research-heading">
          <div className={styles.sectorSectionHeading}>
            <p>Research atlas / Demonstration structure</p>
            <h2 id="science-research-heading">Questions organized around methods.</h2>
          </div>
          <div className={styles.scienceProgrammeList}>
            {programmes.map((programme) => (
              <article key={programme.code}>
                <span>{programme.code}</span>
                <h3>{programme.name}</h3>
                <p>{programme.note}</p>
                <small>{programme.method}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.scienceMethods} id="science-methods" aria-labelledby="science-methods-heading">
          <div className={styles.sectorSectionHeading}>
            <p>From inquiry to reusable knowledge</p>
            <h2 id="science-methods-heading">A visible chain of scientific work.</h2>
          </div>
          <ol className={styles.methodRail}>
            {[
              ["01", "Question", "Define scope, uncertainty, and the decisions the evidence must inform."],
              ["02", "Protocol", "Record materials, instruments, controls, and review conditions."],
              ["03", "Observation", "Preserve the source record before interpretation or synthesis."],
              ["04", "Review", "Expose limitations, alternative explanations, and responsible boundaries."],
              ["05", "Method note", "Publish a versioned account others can inspect and build upon."],
            ].map(([index, title, text]) => (
              <li key={index}>
                <span>{index}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.scienceFacilities} id="science-facilities" aria-labelledby="science-facilities-heading">
          <div className={styles.facilitiesIntro}>
            <p className={styles.sectorEyebrow}>Instrument access / Sample interface</p>
            <h2 id="science-facilities-heading">Facilities described before they are requested.</h2>
            <p>
              An equipment directory can set expectations around capability,
              preparation, access, review, and data stewardship without turning
              instrumentation into decoration.
            </p>
          </div>
          <div className={styles.facilitiesTable} role="region" aria-label="Illustrative instrument records" tabIndex={0}>
            <table>
              <caption>Fictional instrument records for interface demonstration</caption>
              <thead>
                <tr><th scope="col">Record</th><th scope="col">Capability</th><th scope="col">Access state</th></tr>
              </thead>
              <tbody>
                {instruments.map(([record, capability, state]) => (
                  <tr key={record}><td>{record}</td><td>{capability}</td><td>{state}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.moduleSection} aria-labelledby="science-modules-heading">
          <div className={styles.sectorSectionHeading}>
            <p>Digital system</p>
            <h2 id="science-modules-heading">A website designed as research infrastructure.</h2>
          </div>
          <div className={styles.moduleGrid}>
            {showcase.interfaceModules.map((module, index) => (
              <article key={module.name}>
                <span>0{index + 1}</span>
                <Microscope aria-hidden="true" />
                <h3>{module.name}</h3>
                <p>{module.purpose}</p>
                <small>{module.sampleContent}</small>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.sectorCta} id="science-partner">
          <p>Have a laboratory, research programme, or scientific platform to clarify?</p>
          <h2>Make the method as credible as the ambition.</h2>
          <Link href="/contact?brief=science-website">
            Commission a scientific website <ArrowUpRight aria-hidden="true" />
          </Link>
        </section>
        <ConceptDisclosure showcase={showcase} />
      </main>
    </div>
  );
}

function FinanceSite({ showcase }: WebsiteShowcaseProps) {
  const risks = [
    ["Mandate alignment", "Review required", "Investment committee"],
    ["Evidence currency", "Source date visible", "Research lead"],
    ["Scenario sensitivity", "Illustrative range", "Risk function"],
    ["Conflict review", "Declaration recorded", "Governance office"],
  ] as const;

  return (
    <div className={styles.financeSite} data-showcase-sector="finance">
      <ConceptBar showcase={showcase} />
      <div className={styles.financeLayout}>
        <aside className={styles.financeRail}>
          <Link href="#finance-overview" className={styles.financeIdentity}>
            <span>M</span>
            <strong>Meridian<br />Financial Office</strong>
          </Link>
          <nav aria-label="Meridian concept navigation">
            <a href="#finance-mandate">01 / Mandate</a>
            <a href="#finance-process">02 / Decisions</a>
            <a href="#finance-governance">03 / Governance</a>
            <a href="#finance-research">04 / Research</a>
            <a href="#finance-contact">05 / Enquiry</a>
          </nav>
          <small>Concept demonstration<br />Not financial advice</small>
        </aside>

        <main className={styles.financeMain}>
          <section className={styles.financeHero} id="finance-overview">
            <div className={styles.financeDateline}>
              <span>Institutional finance / Concept website</span>
              <span>Mandate · Evidence · Stewardship</span>
            </div>
            <h1>Capital governed by mandate.</h1>
            <div className={styles.financeHeroLower}>
              <p>{showcase.overview}</p>
              <blockquote>
                <span>Policy excerpt / Demonstration copy</span>
                A consequential decision should preserve its mandate, evidence,
                assumptions, dissent, approval, and route to review.
              </blockquote>
            </div>
          </section>

          <section className={styles.financeMandate} id="finance-mandate" aria-labelledby="finance-mandate-heading">
            <div className={styles.financeSectionIndex}>01</div>
            <div>
              <p className={styles.financeKicker}>Mandate before product</p>
              <h2 id="finance-mandate-heading">Clarity before conviction.</h2>
            </div>
            <div className={styles.mandateGrid}>
              {[
                ["Purpose", "State what capital or analysis is expected to achieve—and what it must not compromise."],
                ["Evidence", "Make sources, dates, methods, uncertainty, and review responsibility visible."],
                ["Decision rights", "Show who recommends, challenges, approves, monitors, and reports."],
                ["Stewardship", "Connect each decision to an accountable cycle of observation and review."],
              ].map(([title, text]) => (
                <article key={title}><h3>{title}</h3><p>{text}</p></article>
              ))}
            </div>
          </section>

          <section className={styles.financeProcess} id="finance-process" aria-labelledby="finance-process-heading">
            <div className={styles.financeSectionIndex}>02</div>
            <div>
              <p className={styles.financeKicker}>How decisions move</p>
              <h2 id="finance-process-heading">One accountable capital pathway.</h2>
            </div>
            <ol className={styles.capitalPath}>
              {["Mandate", "Diligence", "Decision", "Stewardship", "Reporting"].map((step, index) => (
                <li key={step}><span>0{index + 1}</span><strong>{step}</strong></li>
              ))}
            </ol>
            <p className={styles.sampleNote}>Illustrative workflow—not a claim about an operating institution or regulated process.</p>
          </section>

          <section className={styles.financeGovernance} id="finance-governance" aria-labelledby="finance-governance-heading">
            <div className={styles.financeSectionIndex}>03</div>
            <div>
              <p className={styles.financeKicker}>Governance ledger</p>
              <h2 id="finance-governance-heading">Risk is explained, not colour-coded away.</h2>
            </div>
            <div className={styles.riskTable} role="region" aria-label="Illustrative governance risk register" tabIndex={0}>
              <table>
                <caption>Sample governance records—no real portfolio, security, client, or financial outcome</caption>
                <thead><tr><th scope="col">Review area</th><th scope="col">Visible state</th><th scope="col">Responsible role</th></tr></thead>
                <tbody>
                  {risks.map(([area, state, owner]) => (
                    <tr key={area}><th scope="row">{area}</th><td>{state}</td><td>{owner}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.financeResearch} id="finance-research" aria-labelledby="finance-research-heading">
            <div className={styles.financeSectionIndex}>04</div>
            <div>
              <p className={styles.financeKicker}>Research and letters</p>
              <h2 id="finance-research-heading">Analysis with its assumptions attached.</h2>
            </div>
            <ol>
              {[
                ["Research note 01", "Reading uncertainty before selecting a scenario"],
                ["Method letter 02", "Designing review rights into the analytical process"],
                ["Stewardship note 03", "What a decision record should preserve"],
              ].map(([label, title]) => (
                <li key={label}><FileText aria-hidden="true" /><span>{label}</span><strong>{title}</strong><small>Demonstration title</small></li>
              ))}
            </ol>
          </section>

          <section className={styles.financeCta} id="finance-contact">
            <p className={styles.financeKicker}>Institutional confidence begins with structure</p>
            <h2>Build a finance website that earns attention quietly.</h2>
            <Link href="/contact?brief=finance-website">
              Commission a finance website <ArrowUpRight aria-hidden="true" />
            </Link>
          </section>
          <ConceptDisclosure showcase={showcase} />
        </main>
      </div>
    </div>
  );
}

function EducationSite({ showcase }: WebsiteShowcaseProps) {
  const timetable = [
    ["MON", "INQ 101", "Question studio"],
    ["TUE", "SYS 124", "Systems seminar"],
    ["WED", "LAB 140", "Applied laboratory"],
    ["THU", "FLD 160", "Field inquiry"],
    ["FRI", "PUB 180", "Public work"],
  ] as const;

  return (
    <div className={styles.educationSite} data-showcase-sector="education">
      <ConceptBar showcase={showcase} />
      <header className={styles.educationHeader}>
        <Link className={styles.educationIdentity} href="#education-overview">
          <span>CI</span>
          <div><strong>Commonfield</strong><small>Institute</small></div>
        </Link>
        <nav aria-label="Commonfield concept navigation">
          <a href="#education-study">Study</a>
          <a href="#education-learning">Learning model</a>
          <a href="#education-work">Student work</a>
          <a href="#education-admissions">Admissions</a>
        </nav>
      </header>

      <main className={styles.educationMain}>
        <section className={styles.educationHero} id="education-overview">
          <div className={styles.educationHeroCopy}>
            <p className={styles.educationKicker}>Learning · Research · Public contribution</p>
            <h1>Learn by building the question.</h1>
            <p>{showcase.overview}</p>
            <a href="#education-study">Explore the learning model <ArrowUpRight aria-hidden="true" /></a>
          </div>
          <div className={styles.timetable} aria-label="Illustrative weekly programme timetable">
            <div className={styles.timetableHeading}>
              <span>Week / 04</span><strong>A living syllabus</strong><span>Sample schedule</span>
            </div>
            <ol>
              {timetable.map(([day, code, label], index) => (
                <li key={day} data-tone={index % 3}>
                  <span>{day}</span><strong>{code}</strong><small>{label}</small>
                </li>
              ))}
            </ol>
            <p>All modules and dates shown are fictional demonstration content.</p>
          </div>
        </section>

        <section className={styles.educationStudy} id="education-study" aria-labelledby="education-study-heading">
          <div className={styles.educationSectionHeading}>
            <p>Programme finder / Demonstration</p>
            <h2 id="education-study-heading">Choose the question you want to become capable of answering.</h2>
          </div>
          <div className={styles.programmeGrid}>
            {[
              ["01", "Intelligent systems", "Technology, evidence, governance, and the human consequences of design.", "Studio + seminar"],
              ["02", "Sustainable enterprise", "Build practical responses to shared economic and ecological challenges.", "Field + venture lab"],
              ["03", "Public problem solving", "Research institutions, services, systems, and projects through public value.", "Research + practice"],
            ].map(([index, title, text, mode]) => (
              <article key={index}><span>{index}</span><GraduationCap aria-hidden="true" /><h3>{title}</h3><p>{text}</p><small>{mode}</small></article>
            ))}
          </div>
        </section>

        <section className={styles.educationLearning} id="education-learning" aria-labelledby="education-learning-heading">
          <div className={styles.educationSectionHeading}>
            <p>How learning unfolds</p>
            <h2 id="education-learning-heading">Knowledge becomes useful through a visible sequence.</h2>
          </div>
          <ol className={styles.learningPath}>
            {[
              ["Inquiry", "Begin with a real question and its context."],
              ["Foundation", "Build the concepts and methods needed to proceed."],
              ["Studio", "Develop, critique, and revise a practical response."],
              ["Fieldwork", "Test assumptions against people, evidence, and place."],
              ["Public work", "Present what was made, learned, and left unresolved."],
            ].map(([title, text], index) => (
              <li key={title}><span>0{index + 1}</span><strong>{title}</strong><p>{text}</p></li>
            ))}
          </ol>
        </section>

        <section className={styles.educationWork} id="education-work" aria-labelledby="education-work-heading">
          <div className={styles.educationSectionHeading}>
            <p>Student work / Fictional project index</p>
            <h2 id="education-work-heading">The work is shown with its question and limits.</h2>
          </div>
          <div className={styles.studentWorkList}>
            {[
              ["CW–024", "A neighbourhood heat-resilience field guide", "Climate · Public systems"],
              ["CW–031", "A transparent AI decision-review protocol", "Technology · Governance"],
              ["CW–046", "A circular materials exchange for small builders", "Enterprise · Materials"],
            ].map(([code, title, field]) => (
              <article key={code}><span>{code}</span><h3>{title}</h3><p>{field}</p><ArrowUpRight aria-hidden="true" /></article>
            ))}
          </div>
        </section>

        <section className={styles.educationModules} aria-labelledby="education-modules-heading">
          <div className={styles.educationSectionHeading}>
            <p>Institutional interface</p>
            <h2 id="education-modules-heading">One public website, many clear journeys.</h2>
          </div>
          <div className={styles.educationModuleGrid}>
            {showcase.interfaceModules.map((module, index) => {
              const Icon = index === 0 ? BookOpen : index === 1 ? CheckCircle2 : CalendarDays;
              return (
                <article key={module.name}><Icon aria-hidden="true" /><h3>{module.name}</h3><p>{module.purpose}</p><small>{module.sampleContent}</small></article>
              );
            })}
          </div>
        </section>

        <section className={styles.educationCta} id="education-admissions">
          <p className={styles.educationKicker}>A school website should make learning visible</p>
          <h2>Build an institution people can understand before they arrive.</h2>
          <Link href="/contact?brief=education-website">
            Commission an education website <ArrowUpRight aria-hidden="true" />
          </Link>
        </section>
        <ConceptDisclosure showcase={showcase} />
      </main>
    </div>
  );
}

export function WebsiteShowcase({ showcase }: WebsiteShowcaseProps) {
  if (showcase.sector === "Scientific research") {
    return <ScienceSite showcase={showcase} />;
  }

  if (showcase.sector === "Finance") {
    return <FinanceSite showcase={showcase} />;
  }

  return <EducationSite showcase={showcase} />;
}
