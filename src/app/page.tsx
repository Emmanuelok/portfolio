import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { IntelligenceOperatingSystem } from "@/components/platform/IntelligenceOperatingSystem";
import { PlatformNexus } from "@/components/platform/PlatformNexus";
import { Reveal } from "@/components/Reveal";
import { SelectedWorkRunway } from "@/components/SelectedWorkRunway";
import { projects } from "@/data/projects";

export default function HomePage() {
  const featured = projects
    .filter((project) => project.featured)
    .slice(0, 4);

  return (
    <main className="page page--home">
      <PlatformNexus />
      <IntelligenceOperatingSystem />
      <SelectedWorkRunway items={featured} />

      <section
        className="kx-practice"
        id="mission"
        aria-labelledby="kx-practice-title"
      >
        <div className="kx-practice__architecture" aria-hidden="true">
          <span>Question</span>
          <span>Project record</span>
          <span>Delivered system</span>
        </div>
        <div className="kx-practice__copy">
          <Reveal>
            <p>03 / The mission</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 id="kx-practice-title">
              Research and development for
              <em>complex, practical work.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>
              kingXford &amp; Co combines applied research, systems thinking,
              responsible AI, product design, and software development. Each
              project keeps its source material, evidence, decisions, and
              revisions together from the first question through delivery.
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
          <span>04 / Start</span>
          <span>Start a local project record from a short brief.</span>
        </Reveal>
        <Reveal>
          <h2 id="home-finale-title">
            Start with the problem.
            <em>Keep the evidence and decisions.</em>
          </h2>
        </Reveal>
        <Reveal className="home-finale__action" delay={0.08}>
          <Link href="/create/workspace?phase=discovery&mode=idea" className="circle-link">
            <span>Start a project</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
