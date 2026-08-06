import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { ProjectSeedAction } from "@/components/ProjectSeedAction";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "R&D / Lab",
  description:
    "The kingXford & Co research and development environment for responsible AI, complex systems, applied inquiry, and sustainable abundance.",
  alternates: {
    canonical: "/lab",
  },
};

const experiments = [
  {
    index: "L–01",
    status: "Research programme",
    title: "Abundance pathways",
    text:
      "Studying the institutions, technologies, resources, capabilities, and distribution choices that can turn rising productivity into sustainable, widely shared value.",
    signal: "Foresight × distribution",
  },
  {
    index: "L–02",
    status: "Applied inquiry",
    title: "Institutional intelligence",
    text:
      "Developing ways for organisations to connect fragmented evidence, surface uncertainty, and improve decisions across complex programmes and projects.",
    signal: "Evidence × decisions",
  },
  {
    index: "L–03",
    status: "Evaluation framework",
    title: "Responsible AI in practice",
    text:
      "Testing intelligent systems for usefulness, reliability, explainability, human oversight, inclusion, and consequences in the settings where they will operate.",
    signal: "Capability × accountability",
  },
  {
    index: "L–04",
    status: "Development track",
    title: "Complex project systems",
    text:
      "Building research, knowledge, and decision infrastructure that helps ambitious multidisciplinary projects move from concept to coordinated delivery.",
    signal: "Ideas × implementation",
  },
] as const;

const questions = [
  "How can abundance be measured beyond aggregate output, including access, resilience, capability, and ecological consequence?",
  "Which decisions should intelligent systems support, and which must remain meaningfully human?",
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
          02 / R&amp;D / Lab
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">
              kingXford &amp; Co · Research &amp; development environment
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="lab-heading">
              <span className="page-hero__line">Research the future.</span>
              <span className="page-hero__line page-hero__line--accent">
                Develop what makes it possible.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            The Lab investigates complex problems, evaluates responsible AI,
            and develops the knowledge, prototypes, and systems people and
            institutions need to prepare for sustainable abundance.
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
          <p className="eyebrow">Current R&amp;D directions</p>
          <h2 id="lab-index-heading">
            Four capabilities being developed through inquiry.
          </h2>
        </div>

        <div className="lab-index__grid">
          {experiments.map((experiment, index) => (
            <Reveal
              className="experiment-card"
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
            <li className="field-notes__entry" key={question}>
              <Reveal className="field-note" delay={index * 0.05}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{question}</p>
                <ArrowUpRight aria-hidden="true" />
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <Reveal className="page-cta">
        <p className="eyebrow">A useful research programme needs a real problem</p>
        <h2>Bring a consequential question that deserves disciplined inquiry.</h2>
        <div className="page-cta__actions">
          <ProjectSeedAction
            seed={{
              action: "start-project",
              source: {
                kind: "lab",
                href: "/lab",
                label: "kingXford Lab research agenda",
              },
              payload: {
                title: "A consequential R&D question",
                brief:
                  "Frame and investigate a consequential question using the kingXford Atlas. Begin with the human need, state uncertainty explicitly, and connect every claim to evidence before prototyping.",
                evidence: experiments.map((experiment) => ({
                  title: experiment.title,
                  content: experiment.text,
                  sourceUrl: "/lab",
                })),
                tags: ["research", "responsible-ai", "lab"],
              },
            }}
            label="Start an R&D project in Canvas"
            description="Carry the Lab agenda forward as a new, traceable project—not a disconnected request."
          />
          <Link className="button button--quiet" href="/work">
            <span>See mission in practice</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
