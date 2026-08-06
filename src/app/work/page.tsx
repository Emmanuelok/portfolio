import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { WorkGrid } from "@/components/WorkGrid";
import { projectCategories, projects } from "@/data/projects";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Published kingXford & Co case studies in digital products, research systems, AI-assisted workflows, and complex project delivery.",
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
          Work
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">kingXford &amp; Co · Published case studies</p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="work-heading">
              <span className="page-hero__line">Research and design,</span>
              <span className="page-hero__line page-hero__line--accent">
                built into working products.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            Each case study sets out the brief, design decisions, working
            product, and current outcome.
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
            <strong>
              {String(projects.filter((project) => project.liveUrl).length).padStart(2, "0")}
            </strong>
            Live products
          </span>
        </div>
      </section>

      <section
        className="work-index"
        id="project-index"
        aria-labelledby="project-index-heading"
      >
        <div className="section-heading">
          <p className="eyebrow">Case-study index</p>
          <h2 id="project-index-heading">Browse the published work.</h2>
        </div>
        <WorkGrid items={projects} />
      </section>

      <Reveal className="page-cta">
        <p className="eyebrow">Have a project to develop?</p>
        <h2>Start with a clear brief for the research, design, or build.</h2>
        <Link className="button button--primary" href="/contact">
          <span>Start a conversation</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Reveal>
    </main>
  );
}
