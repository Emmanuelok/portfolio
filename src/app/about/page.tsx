import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "About Emmanuel",
  description:
    "Meet Emmanuel Kingsford Owusu, the multidisciplinary designer, researcher, educator, and product builder behind Kingxford.",
  alternates: {
    canonical: "/about",
  },
};

const capabilities = [
  {
    index: "01",
    title: "Product & experience",
    text:
      "Product strategy, service architecture, interaction design, prototyping, and the systems that keep a growing platform coherent.",
  },
  {
    index: "02",
    title: "Research & information",
    text:
      "Knowledge architecture, research translation, data-rich interfaces, diagrams, and visual narratives that preserve intellectual depth.",
  },
  {
    index: "03",
    title: "Brand & visual direction",
    text:
      "Identity systems, art direction, campaign concepts, graphic design, and a clear visual point of view across every touchpoint.",
  },
  {
    index: "04",
    title: "AI-enabled systems",
    text:
      "Human-centred workflows that use intelligent models with visible reasoning, useful fallbacks, and deliberate moments of human control.",
  },
] as const;

const method = [
  {
    title: "Decode",
    text:
      "Find the human problem inside the ambitious brief, then name the decisions the experience must make easier.",
  },
  {
    title: "Structure",
    text:
      "Turn domain knowledge into a legible system of journeys, relationships, states, and reusable patterns.",
  },
  {
    title: "Compose",
    text:
      "Give the system a distinct visual rhythm—type, image, motion, space, and interaction working as one voice.",
  },
  {
    title: "Refine",
    text:
      "Test the whole story, remove friction, strengthen the edge cases, and keep polishing until the experience feels inevitable.",
  },
] as const;

export default function AboutPage() {
  return (
    <main className="page page--about">
      <section
        className="page-hero page-hero--about"
        aria-labelledby="about-heading"
      >
        <div className="page-hero__index" aria-hidden="true">
          02 / About
        </div>
        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">
              Emmanuel Kingsford Owusu · Kingxford
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="about-heading">
              <span className="page-hero__line">I design the bridge</span>
              <span className="page-hero__line page-hero__line--accent">
                between difficult ideas and everyday use.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            A Ghanaian multidisciplinary designer, researcher, educator, and
            product builder based in Canada—working wherever technology,
            knowledge, and human ambition meet.
          </p>
        </Reveal>
      </section>

      <section className="about-intro" aria-labelledby="about-intro-title">
        <Reveal className="about-intro__statement">
          <p className="eyebrow">My point of view</p>
          <h2 id="about-intro-title">
            The best design does more than decorate complexity. It gives
            complexity a shape people can enter.
          </h2>
        </Reveal>

        <div className="about-intro__body">
          <Reveal>
            <p>
              My work lives at the intersection of design, research,
              technology, and entrepreneurship. I am drawn to projects with
              many moving parts: knowledge systems, intelligent platforms,
              institutional services, data products, and new digital
              categories that do not yet have an obvious visual language.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <p>
              A background spanning the built environment, economics,
              education, analytics, and AI shapes how I work. I ask structural
              questions, look for the hidden relationship, and then translate
              that logic into an experience that feels clear, expressive, and
              unmistakably considered.
            </p>
          </Reveal>
        </div>

        <Reveal className="about-intro__ledger">
          <dl>
            <div>
              <dt>Based</dt>
              <dd>Canada</dd>
            </div>
            <div>
              <dt>Roots</dt>
              <dd>Ghana</dd>
            </div>
            <div>
              <dt>Range</dt>
              <dd>Products · Systems · Stories</dd>
            </div>
            <div>
              <dt>Working</dt>
              <dd>Across disciplines and borders</dd>
            </div>
          </dl>
        </Reveal>
      </section>

      <section
        className="capabilities"
        aria-labelledby="capabilities-heading"
      >
        <div className="section-heading section-heading--split">
          <p className="eyebrow">What I bring</p>
          <h2 id="capabilities-heading">
            One creative practice, expressed at different scales.
          </h2>
        </div>
        <div className="capabilities__grid">
          {capabilities.map((capability, index) => (
            <Reveal
              className="capability-card"
              delay={index * 0.06}
              key={capability.title}
            >
              <span>{capability.index}</span>
              <h3>{capability.title}</h3>
              <p>{capability.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="method" aria-labelledby="method-heading">
        <div className="section-heading section-heading--split">
          <p className="eyebrow">How I work</p>
          <h2 id="method-heading">Deep thinking. Clear moves. Relentless finish.</h2>
        </div>
        <ol className="method__track">
          {method.map((step, index) => (
            <li className="method__entry" key={step.title}>
              <Reveal className="method__step" delay={index * 0.06}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <Reveal className="about-note">
        <p className="about-note__mark" aria-hidden="true">
          “
        </p>
        <blockquote>
          I am interested in work that earns attention twice: first through
          its presence, then through the quality of its thinking.
        </blockquote>
      </Reveal>

      <Reveal className="page-cta">
        <p className="eyebrow">Selected collaborations</p>
        <h2>Bring the difficult brief. We&apos;ll find its clearest form.</h2>
        <div className="page-cta__actions">
          <Link className="button button--primary" href="/contact">
            <span>Start a conversation</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link className="button button--quiet" href="/work">
            <span>Explore the work</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
