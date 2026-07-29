import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Reveal } from "@/components/Reveal";
import { WorkGrid } from "@/components/WorkGrid";
import { projectCategories, projects } from "@/data/projects";

export const metadata: Metadata = {
  title: "Selected work",
  description:
    "Selected work from Kingxford Studio, the multidisciplinary practice of Emmanuel Kingsford Owusu—digital products, research platforms, visual systems, and intelligent web experiences.",
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
          01 / Selected work
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">Kingxford Studio archive · 2026</p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="work-heading">
              <span className="page-hero__line">Built to make</span>
              <span className="page-hero__line page-hero__line--accent">
                complexity feel inevitable.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            Product systems, research interfaces, intelligent tools, and
            digital worlds—each shaped around a real problem and a clear
            point of view.
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
            Point of view
          </span>
        </div>
      </section>

      <section
        className="work-index"
        id="project-index"
        aria-labelledby="project-index-heading"
      >
        <div className="section-heading">
          <p className="eyebrow">Project index</p>
          <h2 id="project-index-heading">Choose a thread to follow.</h2>
        </div>
        <WorkGrid />
      </section>

      <Reveal className="page-cta">
        <p className="eyebrow">Have an ambitious brief?</p>
        <h2>Let&apos;s give it a form people remember.</h2>
        <Link className="button button--primary" href="/contact">
          <span>Start a conversation</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Reveal>
    </main>
  );
}
