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
          <span>Shared intelligence</span>
          <span>Durable capability</span>
        </div>
        <div className="kx-practice__copy">
          <Reveal>
            <p>03 / The mission</p>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 id="kx-practice-title">
              Developing intelligence for
              <em>an abundant future.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>
              kingXford &amp; Co is one connected intelligence platform for
              consequential work. Research, evidence, systems thinking,
              responsible AI, design, and development remain attached to the
              same project from its first question to its operating reality.
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
          <span>Your first sentence becomes a continuing project.</span>
        </Reveal>
        <Reveal>
          <h2 id="home-finale-title">
            Bring the ambition.
            <em>Keep the whole intelligence.</em>
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
