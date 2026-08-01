import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { KingxfordCinematic } from "@/components/KingxfordCinematic";
import {
  IdeaRouter,
  KingxfordWorlds,
} from "@/components/KingxfordWorlds";
import { Reveal } from "@/components/Reveal";
import { SelectedWorkRunway } from "@/components/SelectedWorkRunway";
import { projects } from "@/data/projects";

const method = [
  {
    number: "01",
    title: "Investigate",
    copy: "Find the real system, evidence, and human stakes beneath the brief.",
  },
  {
    number: "02",
    title: "Model",
    copy: "Turn complexity into testable relationships, scenarios, and decisions.",
  },
  {
    number: "03",
    title: "Develop",
    copy: "Build the research, intelligence, prototype, or system the mission needs.",
  },
  {
    number: "04",
    title: "Validate",
    copy: "Test impact, responsibility, resilience, and usefulness before scaling.",
  },
] as const;

export default function HomePage() {
  const featured = projects
    .filter((project) => project.featured)
    .slice(0, 4);

  return (
    <main className="page page--home">
      <KingxfordCinematic />
      <KingxfordWorlds />
      <SelectedWorkRunway items={featured} />
      <IdeaRouter />

      <section
        className="kx-method"
        aria-labelledby="kx-method-title"
      >
        <div className="kx-method__topline">
          <span>04 / How kingXford &amp; Co works</span>
          <span>One thread from uncertainty to durable value</span>
        </div>
        <Reveal className="kx-method__heading">
          <h2 id="kx-method-title">
            Evidence before certainty.
            <em>Responsibility before scale.</em>
          </h2>
        </Reveal>
        <div className="kx-method__steps">
          {method.map((step, index) => (
            <Reveal
              className="kx-method__step"
              delay={index * 0.06}
              key={step.number}
            >
              <span>{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section
        className="kx-practice"
        aria-labelledby="kx-practice-title"
      >
        <div className="kx-practice__architecture" aria-hidden="true">
          <span>Evidence</span>
          <span>Intelligence</span>
          <span>Development</span>
        </div>
        <div className="kx-practice__copy">
          <Reveal>
            <p>05 / The mission</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 id="kx-practice-title">
              Developing intelligence for
              <em>an abundant future.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>
              kingXford &amp; Co brings research, technology, responsible AI,
              strategic intelligence, and development together to help people
              and institutions solve complex problems and advance ambitious
              ideas and projects with lasting value.
            </p>
          </Reveal>
          <Reveal className="kx-practice__actions" delay={0.15}>
            <Link className="button button--primary" href="/about">
              Explore the mission
              <ArrowUpRight aria-hidden="true" />
            </Link>
            <Link className="button button--quiet" href="/work">
              View the work
              <ArrowDownRight aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="home-finale" aria-labelledby="home-finale-title">
        <div className="home-finale__noise" aria-hidden="true" />
        <Reveal className="home-finale__meta">
          <span>Craft signature</span>
          <span>For problems, ideas, and projects worth advancing.</span>
        </Reveal>
        <Reveal>
          <h2 id="home-finale-title">
            Complex ideas.
            <em>Unforgettable form.</em>
          </h2>
        </Reveal>
        <Reveal className="home-finale__action" delay={0.08}>
          <Link href="/contact" className="circle-link">
            <span>Advance something</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
