import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Kingxford Lab",
  description:
    "The experimental wing of Kingxford Studio—visual, interaction, motion, and intelligent-system studies by Emmanuel Kingsford Owusu.",
  alternates: {
    canonical: "/lab",
  },
};

const experiments = [
  {
    index: "L–01",
    status: "Ongoing study",
    title: "Living identities",
    text:
      "Brand systems whose behaviour—not only their logo—creates recognition through rhythm, response, and change over time.",
    signal: "Identity × motion",
  },
  {
    index: "L–02",
    status: "Prototype pattern",
    title: "Interface choreography",
    text:
      "Using transition, depth, sound-aware timing, and spatial continuity to make a complex product feel like one unfolding scene.",
    signal: "Motion × meaning",
  },
  {
    index: "L–03",
    status: "Research thread",
    title: "Spatial evidence",
    text:
      "Turning ontologies, infrastructure, causal chains, and dense research models into navigable visual environments.",
    signal: "Data × space",
  },
  {
    index: "L–04",
    status: "Design inquiry",
    title: "Legible intelligence",
    text:
      "Interaction patterns that reveal what an intelligent system used, what it inferred, where it is uncertain, and what remains a human decision.",
    signal: "AI × agency",
  },
] as const;

const questions = [
  "What if an interface could explain its reasoning without asking for blind trust?",
  "What if a research diagram behaved like a place you could explore?",
  "What if a visual identity changed with the journey while remaining unmistakably itself?",
  "What if motion carried information instead of simply decorating the transition?",
] as const;

export default function LabPage() {
  return (
    <main className="page page--lab">
      <section
        className="page-hero page-hero--lab"
        aria-labelledby="lab-heading"
      >
        <div className="page-hero__index" aria-hidden="true">
          03 / Kingxford Lab
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">
              Kingxford Studio · Experimental wing
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="lab-heading">
              <span className="page-hero__line">A place to test</span>
              <span className="page-hero__line page-hero__line--accent">
                what the polished work cannot risk yet.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            The lab is an open edge: visual behaviours, interaction patterns,
            and intelligent-system ideas explored before they become a
            product, a system, or a new way of seeing.
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
          <p className="eyebrow">Current experiments</p>
          <h2 id="lab-index-heading">
            Four questions being made tangible.
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
          <p className="eyebrow">Field notes / 2026</p>
          <h2 id="field-notes-heading">Questions worth keeping open.</h2>
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
        <p className="eyebrow">A useful experiment needs a real constraint</p>
        <h2>Have a strange, difficult, or entirely new design problem?</h2>
        <div className="page-cta__actions">
          <Link className="button button--primary" href="/contact">
            <span>Bring it to the lab</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link className="button button--quiet" href="/work">
            <span>See what shipped</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
