import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { PLATFORM_LIFECYCLE } from "@/lib/platform/registry";

export const metadata: Metadata = {
  title: "About kingXford & Co",
  description:
    "Discover the kingXford & Co mission: intelligence, research and development, and responsible AI for sustainable abundance.",
  alternates: {
    canonical: "/about",
  },
};

const capabilities = [
  {
    index: "01",
    title: "Strategic intelligence",
    text:
      "Systems analysis, foresight, decision support, and problem framing that help institutions distinguish signal from noise and act with clarity.",
  },
  {
    index: "02",
    title: "Research & development",
    text:
      "Applied inquiry, experimentation, evidence synthesis, prototypes, and knowledge translation designed to move consequential questions toward usable capability.",
  },
  {
    index: "03",
    title: "Responsible AI",
    text:
      "Human-centred intelligent systems with visible uncertainty, meaningful oversight, evaluation, governance, and deliberate human control.",
  },
  {
    index: "04",
    title: "Complex project development",
    text:
      "The structures, partnerships, products, communication, and delivery systems that turn ambitious ideas into resilient projects and institutions.",
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
              kingXford &amp; Co · Mission / Operating model
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="about-heading">
              <span className="page-hero__line">Intelligence for people</span>
              <span className="page-hero__line page-hero__line--accent">
                preparing an abundant future.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            One connected platform for research, development, responsible AI,
            and the advancement of complex ideas and projects with durable
            human and ecological value.
          </p>
        </Reveal>
      </section>

      <section className="about-intro" aria-labelledby="about-intro-title">
        <Reveal className="about-intro__statement">
          <p className="eyebrow">Our reason for being</p>
          <h2 id="about-intro-title">
            Expanding intelligence should expand humanity&apos;s capacity to solve
            hard problems—and to share progress more sustainably.
          </h2>
        </Reveal>

        <div className="about-intro__body">
          <Reveal>
            <p>
              Our work begins with consequential questions: how people and
              institutions can understand complex systems, develop stronger
              ideas, govern intelligent technologies responsibly, and prepare
              for futures in which knowledge and productive capacity can create
              broader, longer-lasting value.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <p>
              The “&amp; Co” represents the people and institutions that invest in
              this mission through capital, knowledge, time, research capacity,
              infrastructure, networks, and trust. It is a collaborative
              operating philosophy—not a securities offer, investment fund,
              public solicitation, or roster of named staff.
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
              <dd>Intelligence · R&amp;D · Responsible AI</dd>
            </div>
            <div>
              <dt>Partners</dt>
              <dd>People · Institutions · Coalitions</dd>
            </div>
            <div>
              <dt>Delivery</dt>
              <dd>One project · Six connected phases</dd>
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
            Capability organised around consequential outcomes.
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
            One intelligence thread from first question to governed launch.
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
          The mission comes first. “Complex ideas. Unforgettable form.” is the
          craft standard by which we make that mission legible and useful.
        </blockquote>
      </Reveal>

      <Reveal className="page-cta">
        <p className="eyebrow">Advance the mission</p>
        <h2>Bring the complex problem, ambitious idea, or consequential project.</h2>
        <div className="page-cta__actions">
          <Link className="button button--primary" href="/create/workspace?phase=discovery&mode=idea">
            <span>Start in the workspace</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link className="button button--quiet" href="/contact">
            <span>Prepare a build brief</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
