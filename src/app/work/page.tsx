import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { WorkGrid } from "@/components/WorkGrid";
import { projectCategories, projects } from "@/data/projects";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Mission in practice from kingXford & Co: research, intelligent systems, responsible AI, and complex project development.",
  alternates: {
    canonical: "/work",
  },
};

export default function WorkPage() {
  return (
    <main className="page page--work">
      <section
        className="page-hero page-hero--work"
        aria-labelledby="work-heading"
      >
        <div className="page-hero__index" aria-hidden="true">
          03 / Work
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">kingXford &amp; Co · Mission in practice</p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="work-heading">
              <span className="page-hero__line">Intelligence and research,</span>
              <span className="page-hero__line page-hero__line--accent">
                developed into working systems.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            Evidence of how complex problems, ambitious ideas, and
            consequential projects move from inquiry to tested, useful form.
          </p>
          <a className="text-link" href="#project-index">
            <span>Browse the index</span>
            <ArrowDownRight aria-hidden="true" />
          </a>
        </Reveal>

        <div className="page-hero__ledger" aria-label="Archive summary">
          <span>
            <strong>{String(projects.length).padStart(2, "0")}</strong>
            Projects
          </span>
          <span>
            <strong>{String(projectCategories.length).padStart(2, "0")}</strong>
            Disciplines
          </span>
          <span>
            <strong>01</strong>
            Shared mission
          </span>
        </div>
      </section>

      <section
        className="work-index"
        id="project-index"
        aria-labelledby="project-index-heading"
      >
        <div className="section-heading">
          <p className="eyebrow">Evidence index</p>
          <h2 id="project-index-heading">Follow the problem into practice.</h2>
        </div>
        <WorkGrid items={projects} />
      </section>

      <Reveal className="page-cta">
        <p className="eyebrow">Have a consequential challenge?</p>
        <h2>Let&apos;s turn complexity into tested capability.</h2>
        <Link className="button button--primary" href="/contact">
          <span>Start a conversation</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Reveal>
    </main>
  );
}
