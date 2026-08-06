import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { ProjectCaptureAction } from "@/components/platform/ProjectCaptureAction";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "R&D / Lab",
  description:
    "Current kingXford & Co research themes in responsible AI, institutional decision-making, complex projects, and sustainable systems.",
  alternates: {
    canonical: "/lab",
  },
};

const experiments = [
  {
    id: "abundance-pathways",
    index: "L–01",
    status: "Research theme",
    title: "Abundance pathways",
    text:
      "Studying the institutions, technologies, resources, capabilities, and distribution choices that can turn rising productivity into sustainable, widely shared value.",
    signal: "Foresight × distribution",
  },
  {
    id: "institutional-intelligence",
    index: "L–02",
    status: "Research theme",
    title: "Institutional intelligence",
    text:
      "Developing ways for organisations to connect fragmented evidence, surface uncertainty, and improve decisions across complex programmes and projects.",
    signal: "Evidence × decisions",
  },
  {
    id: "responsible-ai-practice",
    index: "L–03",
    status: "Evaluation theme",
    title: "Responsible AI in practice",
    text:
      "Testing AI-assisted systems for usefulness, reliability, explainability, human oversight, inclusion, and consequences in the settings where they will operate.",
    signal: "Capability × accountability",
  },
  {
    id: "complex-project-systems",
    index: "L–04",
    status: "Research theme",
    title: "Complex project systems",
    text:
      "Building research, knowledge, and decision infrastructure that helps ambitious multidisciplinary projects move from concept to coordinated delivery.",
    signal: "Ideas × implementation",
  },
] as const;

const questions = [
  "How can abundance be measured beyond aggregate output, including access, resilience, capability, and ecological consequence?",
  "Which decisions should AI-assisted systems support, and which must remain meaningfully human?",
  "How can institutions preserve uncertainty and dissent while still acting in time?",
  "What research and infrastructure must exist before an ambitious idea can become a durable project?",
] as const;

export default function LabPage() {
  return (
    <main className="page page--lab">
      <section
        className="page-hero page-hero--lab"
        aria-labelledby="lab-heading"
      >
        <div className="page-hero__index" aria-hidden="true">
          Lab
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">
              kingXford &amp; Co · Research &amp; development
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="lab-heading">
              <span className="page-hero__line">Investigate hard questions.</span>
              <span className="page-hero__line page-hero__line--accent">
                Build what the evidence supports.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            The Lab studies how institutions can use evidence, responsible AI,
            and digital systems to make better decisions and deliver complex
            projects.
          </p>
        </Reveal>

        <div className="lab-constellation" aria-hidden="true">
          <span className="lab-constellation__ring lab-constellation__ring--one" />
          <span className="lab-constellation__ring lab-constellation__ring--two" />
          <span className="lab-constellation__core">KX</span>
          <span className="lab-constellation__node lab-constellation__node--one" />
          <span className="lab-constellation__node lab-constellation__node--two" />
          <span className="lab-constellation__node lab-constellation__node--three" />
        </div>
      </section>

      <section className="lab-index" aria-labelledby="lab-index-heading">
        <div className="section-heading section-heading--split">
          <p className="eyebrow">Current research themes</p>
          <h2 id="lab-index-heading">
            Four themes guiding current research and prototyping.
          </h2>
        </div>

        <div className="lab-index__grid">
          {experiments.map((experiment, index) => (
            <Reveal
              className="experiment-card"
              id={experiment.id}
              delay={index * 0.06}
              key={experiment.index}
            >
              <div className="experiment-card__top">
                <span>{experiment.index}</span>
                <span>{experiment.status}</span>
              </div>
              <div className="experiment-card__visual" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <h3>{experiment.title}</h3>
              <p>{experiment.text}</p>
              <div className="experiment-card__signal">
                <Plus aria-hidden="true" />
                <span>{experiment.signal}</span>
              </div>
              <div className="experiment-card__capture">
                <ProjectCaptureAction
                  title={experiment.title}
                  claim={experiment.text}
                  referenceHref={`/lab#${experiment.id}`}
                  source="lab"
                />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="field-notes" aria-labelledby="field-notes-heading">
        <div className="section-heading">
          <p className="eyebrow">Research agenda</p>
          <h2 id="field-notes-heading">Questions that resist easy certainty.</h2>
        </div>
        <ol className="field-notes__list">
          {questions.map((question, index) => (
            <li
              className="field-notes__entry"
              id={`research-question-${index + 1}`}
              key={question}
            >
              <Reveal className="field-note" delay={index * 0.05}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{question}</p>
                <ArrowUpRight aria-hidden="true" />
                <div className="field-note__capture">
                  <ProjectCaptureAction
                    compact
                    title={`Research question ${String(index + 1).padStart(2, "0")}`}
                    claim={question}
                    referenceHref={`/lab#research-question-${index + 1}`}
                    source="lab"
                  />
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <Reveal className="page-cta">
        <p className="eyebrow">A useful research programme starts with a real problem</p>
        <h2>Bring a question that needs disciplined inquiry.</h2>
        <div className="page-cta__actions">
          <Link className="button button--primary" href="/contact">
            <span>Propose an R&amp;D challenge</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link className="button button--quiet" href="/work">
            <span>See mission in practice</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
