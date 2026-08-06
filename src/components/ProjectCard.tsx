"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { m, useReducedMotion } from "motion/react";

import { ProjectCaptureAction } from "@/components/platform/ProjectCaptureAction";
import type { Project } from "@/data/projects";

type ProjectCardProps = Readonly<{
  project: Project;
  index?: number;
  priority?: boolean;
  featured?: boolean;
}>;

export function ProjectCard({
  project,
  index = 0,
  priority = false,
  featured = false,
}: ProjectCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const cardNumber = String(index + 1).padStart(2, "0");

  return (
    <m.article
      className={
        featured ? "project-card project-card--featured" : "project-card"
      }
      layout={!shouldReduceMotion}
      initial={false}
      whileHover={shouldReduceMotion ? undefined : { y: -7 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href={`/work/${project.slug}`}
        className="project-card__link"
        aria-label={`View ${project.title} case study`}
      >
        <div className="project-card__media">
          <Image
            className="project-card__image"
            src={project.cover}
            alt={project.coverAlt}
            width={2400}
            height={1600}
            quality={90}
            priority={priority}
            sizes={
              featured
                ? "(max-width: 760px) 94vw, 88vw"
                : "(max-width: 760px) 94vw, (max-width: 1200px) 47vw, 42vw"
            }
          />
          <span className="project-card__scrim" aria-hidden="true" />
          <span className="project-card__index" aria-hidden="true">
            {cardNumber}
          </span>
          <span className="project-card__view">
            Read case study
            <ArrowUpRight aria-hidden="true" />
          </span>
        </div>

        <div className="project-card__body">
          <div className="project-card__meta">
            <span>{project.eyebrow}</span>
            <span className="project-card__meta-rule" aria-hidden="true" />
            <time>{project.year}</time>
          </div>
          <h3 className="project-card__title">{project.title}</h3>
          <p className="project-card__summary">{project.summary}</p>
          <ul className="project-card__tags" aria-label="Project categories">
            {project.categories.map((category) => (
              <li key={category}>{category}</li>
            ))}
          </ul>
        </div>
      </Link>
      <div className="project-card__capture">
        <ProjectCaptureAction
          compact
          title={project.title}
          claim={project.summary}
          referenceHref={`/work/${project.slug}`}
          source="work"
        />
      </div>
    </m.article>
  );
}
