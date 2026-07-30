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
    title: "Listen",
    copy: "Find the real question beneath the brief.",
  },
  {
    number: "02",
    title: "Structure",
    copy: "Turn complexity into a clear system of decisions.",
  },
  {
    number: "03",
    title: "Compose",
    copy: "Make language, image, motion, and interaction speak as one.",
  },
  {
    number: "04",
    title: "Release",
    copy: "Build, test, and refine until the work can live in the world.",
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
          <span>04 / How Kingxford works</span>
          <span>One thread from ambiguity to form</span>
        </div>
        <Reveal className="kx-method__heading">
          <h2 id="kx-method-title">
            The work changes.
            <em>The standard does not.</em>
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
          <span>K</span>
          <span>X</span>
          <span>F</span>
        </div>
        <div className="kx-practice__copy">
          <Reveal>
            <p>05 / The practice</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 id="kx-practice-title">
              Built where design, research,
              <em>and technology meet.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>
              Kingxford is the multidisciplinary practice of Emmanuel
              Kingsford Owusu—a designer, researcher, educator, and product
              builder working from Canada across borders and disciplines.
            </p>
          </Reveal>
          <Reveal className="kx-practice__actions" delay={0.15}>
            <Link className="button button--primary" href="/about">
              Meet Emmanuel
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
          <span>Have a difficult idea?</span>
          <span>Good. Those are the interesting ones.</span>
        </Reveal>
        <Reveal>
          <h2 id="home-finale-title">
            Let&apos;s give it
            <em>unforgettable form.</em>
          </h2>
        </Reveal>
        <Reveal className="home-finale__action" delay={0.08}>
          <Link href="/contact" className="circle-link">
            <span>Start something</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
