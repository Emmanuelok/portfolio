import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { KingxfordCinematic } from "@/components/KingxfordCinematic";
import {
  IdeaRouter,
  KingxfordWorlds,
} from "@/components/KingxfordWorlds";
import { PlatformContinuum } from "@/components/PlatformContinuum";
import { Reveal } from "@/components/Reveal";
import { SelectedWorkRunway } from "@/components/SelectedWorkRunway";
import { projects } from "@/data/projects";

export default function HomePage() {
  const featured = projects
    .filter((project) => project.featured)
    .slice(0, 4);

  return (
    <main className="page page--home">
      <KingxfordCinematic />
      <KingxfordWorlds />
      <IdeaRouter />
      <PlatformContinuum />
      <SelectedWorkRunway items={featured} />

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
