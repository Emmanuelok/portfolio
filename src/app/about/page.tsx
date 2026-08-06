import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { PLATFORM_LIFECYCLE } from "@/lib/platform/registry";

export const metadata: Metadata = {
  title: "About kingXford & Co",
  description:
    "How kingXford & Co combines research, product development, and responsible AI to address complex institutional and public challenges.",
  alternates: {
    canonical: "/about",
  },
};

const capabilities = [
  {
    index: "01",
    title: "Strategy and decision support",
    text:
      "We frame decisions, map systems, compare scenarios, and separate useful signals from noise.",
  },
  {
    index: "02",
    title: "Research & development",
    text:
      "We investigate difficult questions, synthesize evidence, and build prototypes that turn research into usable tools.",
  },
  {
    index: "03",
    title: "Responsible AI",
    text:
      "We design AI-assisted systems with visible uncertainty, meaningful review, clear evaluation, and deliberate human control.",
  },
  {
    index: "04",
    title: "Complex project development",
    text:
      "We design the partnerships, governance, products, and delivery plans that move complex projects from concept to delivery.",
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
          About
        </div>
        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">
              Mission · Working model · Capabilities
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="about-heading">
              <span className="page-hero__line">Complex problems, studied closely.</span>
              <span className="page-hero__line page-hero__line--accent">
                Responsible systems, built to last.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            One practice combining research, responsible AI, design, and
            development for complex institutional and public challenges.
          </p>
        </Reveal>
      </section>

      <section className="about-intro" aria-labelledby="about-intro-title">
        <Reveal className="about-intro__statement">
          <p className="eyebrow">Our reason for being</p>
          <h2 id="about-intro-title">
            Better tools should help more people solve hard problems—and share
            the benefits without passing costs to others.
          </h2>
        </Reveal>

        <div className="about-intro__body">
          <Reveal>
            <p>
              We help people and institutions frame complex problems, test
              assumptions against evidence, and build responsible systems that
              can operate in practice.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <p>
              “&amp; Co” refers to collaborators and institutions that contribute
              capital, knowledge, time, infrastructure, networks, or trust. It
              describes how we work; it is not a fund, public offering, or
              fixed roster of partners.
            </p>
          </Reveal>
        </div>

        <Reveal className="about-intro__ledger">
          <dl>
            <div>
              <dt>Purpose</dt>
              <dd>Sustainable abundance</dd>
            </div>
            <div>
              <dt>Means</dt>
              <dd>Research · Design · Responsible AI</dd>
            </div>
            <div>
              <dt>Partners</dt>
              <dd>People · Institutions · Coalitions</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>Six-phase project lifecycle</dd>
            </div>
          </dl>
        </Reveal>
      </section>

      <section
        className="capabilities"
        aria-labelledby="capabilities-heading"
      >
        <div className="section-heading section-heading--split">
          <p className="eyebrow">Core capabilities</p>
          <h2 id="capabilities-heading">
            Four capabilities applied to real decisions and delivery.
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
          <p className="eyebrow">How we work</p>
          <h2 id="method-heading">
            A six-phase path from problem definition to accountable delivery.
          </h2>
        </div>
        <ol className="method__track">
          {PLATFORM_LIFECYCLE.map((step, index) => (
            <li className="method__entry" key={step.id}>
              <Reveal className="method__step" delay={index * 0.06}>
                <span>{step.index}</span>
                <h3>{step.label}</h3>
                <p>{step.description}</p>
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
          The mission sets the direction. Clear design and careful delivery
          make the work useful.
        </blockquote>
      </Reveal>

      <Reveal className="page-cta">
        <p className="eyebrow">Start with the problem</p>
        <h2>Bring the question you need to understand, test, or build around.</h2>
        <div className="page-cta__actions">
          <Link className="button button--primary" href="/create/workspace?phase=discovery&mode=idea">
            <span>Open Canvas</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link className="button button--quiet" href="/contact">
            <span>Prepare a project brief</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
