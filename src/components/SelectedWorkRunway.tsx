import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ProjectCaptureAction } from "@/components/platform/ProjectCaptureAction";
import { Reveal } from "@/components/Reveal";
import type { Project } from "@/data/projects";

type SelectedWorkRunwayProps = Readonly<{
  items: readonly Project[];
}>;

export function SelectedWorkRunway({
  items,
}: SelectedWorkRunwayProps) {
  return (
    <section
      className="work-runway"
      id="selected-work"
      aria-labelledby="work-runway-title"
    >
      <header className="work-runway__header">
        <Reveal className="work-runway__index">
          <span>02 / Selected work</span>
          <span>Published case studies and current outcomes</span>
        </Reveal>
        <Reveal className="work-runway__heading" delay={0.05}>
          <h2 id="work-runway-title">
            Complex briefs,
            <em>built into working products.</em>
          </h2>
          <p>
            Case studies in digital products, AI-assisted experiences,
            research tools, and decision systems.
          </p>
        </Reveal>
      </header>

      <div className="work-runway__list">
        {items.map((project, index) => (
          <Reveal
            className="work-runway__item"
            delay={Math.min(index * 0.05, 0.15)}
            key={project.slug}
          >
            <Link
              href={`/work/${project.slug}`}
              aria-label={`View ${project.title} case study`}
            >
              <div className="work-runway__media">
                <Image
                  src={project.cover}
                  alt={project.coverAlt}
                  fill
                  quality={94}
                  priority={index === 0}
                  sizes="(max-width: 760px) 100vw, 86vw"
                />
                <span aria-hidden="true" />
              </div>
              <div className="work-runway__copy">
                <div className="work-runway__number">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{project.year}</span>
                </div>
                <div>
                  <p>{project.eyebrow}</p>
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <ul aria-label={`${project.title} disciplines`}>
                    {project.categories.map((category) => (
                      <li key={category}>{category}</li>
                    ))}
                  </ul>
                </div>
                <span className="work-runway__view">
                  View case
                  <ArrowUpRight aria-hidden="true" />
                </span>
              </div>
            </Link>
            <div className="work-runway__capture">
              <ProjectCaptureAction
                compact
                title={project.title}
                claim={project.summary}
                referenceHref={`/work/${project.slug}`}
                source="work"
              />
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="work-runway__archive">
        <Link href="/work">
          <span>Browse all case studies</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Reveal>
    </section>
  );
}
