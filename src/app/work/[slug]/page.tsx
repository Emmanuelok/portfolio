import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";

import { ProjectSeedAction } from "@/components/ProjectSeedAction";
import { Reveal } from "@/components/Reveal";
import {
  getProjectBySlug,
  projects,
  type Project,
} from "@/data/projects";

type ProjectPageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://kingxford.co";

// Known case studies are prerendered; unknown slugs reach the explicit
// notFound() boundary without being logged as internal fallback failures.
export const dynamicParams = true;

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    return {
      title: "Project not found",
      robots: { index: false, follow: false },
    };
  }

  const canonical = `/work/${project.slug}`;
  const coverUrl = `${siteUrl}${project.cover}`;

  return {
    title: project.title,
    description: project.summary,
    alternates: { canonical },
    openGraph: {
      title: `${project.title} — kingXford & Co`,
      description: project.summary,
      type: "article",
      url: canonical,
      images: [
        {
          url: coverUrl,
          width: 2400,
          height: 1600,
          alt: project.coverAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${project.title} — kingXford & Co`,
      description: project.summary,
      images: [coverUrl],
    },
  };
}

function RelatedProjectCard({ project }: Readonly<{ project: Project }>) {
  return (
    <Link className="related-card" href={`/work/${project.slug}`}>
      <div className="related-card__media">
        <Image
          src={project.cover}
          alt={project.coverAlt}
          width={2400}
          height={1600}
          quality={90}
          sizes="(max-width: 760px) 100vw, 50vw"
          className="related-card__image"
        />
        <span
          className="related-card__wash"
          style={{ backgroundColor: project.accent }}
          aria-hidden="true"
        />
      </div>
      <div className="related-card__meta">
        <div>
          <p>{project.eyebrow}</p>
          <h3>{project.title}</h3>
        </div>
        <ArrowUpRight aria-hidden="true" />
      </div>
    </Link>
  );
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  const projectIndex = projects.findIndex((item) => item.slug === project.slug);
  const nextProject = projects[(projectIndex + 1) % projects.length];
  const relatedProjects = project.related
    .map((relatedSlug) => getProjectBySlug(relatedSlug))
    .filter((item): item is Project => Boolean(item));

  return (
    <main
      className="page project-page"
      style={{ "--project-accent": project.accent } as CSSProperties}
    >
      <article>
        <header className="project-hero">
          <div className="project-hero__nav">
            <Link className="text-link" href="/work">
              <ArrowLeft aria-hidden="true" />
              <span>All work</span>
            </Link>
            <span>
              {String(projectIndex + 1).padStart(2, "0")} /{" "}
              {String(projects.length).padStart(2, "0")}
            </span>
          </div>

          <div className="project-hero__heading">
            <Reveal>
              <p className="eyebrow">{project.eyebrow}</p>
            </Reveal>
            <Reveal distance={48}>
              <h1>{project.title}</h1>
            </Reveal>
            <Reveal className="project-hero__statement" delay={0.08}>
              <p>{project.statement}</p>
            </Reveal>
          </div>

          <Reveal className="project-hero__meta" delay={0.14}>
            <div>
              <p className="meta-label">Year</p>
              <p>{project.year}</p>
            </div>
            <div>
              <p className="meta-label">Disciplines</p>
              <p>{project.categories.join(" · ")}</p>
            </div>
            <div>
              <p className="meta-label">Role</p>
              <p>{project.role.join(" · ")}</p>
            </div>
          </Reveal>

          <Reveal className="project-hero__media" amount={0.08}>
            <Image
              src={project.cover}
              alt={project.coverAlt}
              width={2400}
              height={1600}
              quality={94}
              sizes="100vw"
              priority
              className="project-hero__image"
            />
            <span className="project-hero__media-index" aria-hidden="true">
              KX / {String(projectIndex + 1).padStart(2, "0")}
            </span>
          </Reveal>
        </header>

        <section className="project-brief" aria-labelledby="project-brief-title">
          <Reveal className="project-brief__lead">
            <p className="eyebrow">The project</p>
            <h2 id="project-brief-title">{project.summary}</h2>
          </Reveal>

          <div className="project-brief__columns">
            <Reveal>
              <p className="meta-label">Challenge</p>
              <p>{project.challenge}</p>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="meta-label">Current outcome</p>
              <p>{project.outcome}</p>
            </Reveal>
          </div>

          {project.liveUrl && (
            <Reveal className="project-links">
              <a
                className="button button--primary"
                href={project.liveUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span>Visit live project</span>
                <ArrowUpRight aria-hidden="true" />
              </a>
            </Reveal>
          )}

          <Reveal className="project-links" delay={0.08}>
            <ProjectSeedAction
              seed={{
                action: "add-evidence",
                source: {
                  kind: "work",
                  href: `/work/${project.slug}`,
                  label: `Published work: ${project.title}`,
                },
                payload: {
                  title: `Evidence from ${project.title}`,
                  brief: project.summary,
                  evidence: [
                    {
                      title: `${project.title} case evidence`,
                      content: `Challenge: ${project.challenge}\n\nCurrent outcome: ${project.outcome}`,
                      sourceUrl: `/work/${project.slug}`,
                    },
                  ],
                  tags: [...project.categories, "published-work"],
                },
              }}
              label="Add this case to Canvas"
              description="Save the challenge and current outcome as project evidence."
              variant="evidence"
            />
          </Reveal>
        </section>

        <section
          className="project-approach"
          aria-labelledby="project-approach-title"
        >
          <div className="section-heading section-heading--split">
            <p className="eyebrow">What we designed</p>
            <h2 id="project-approach-title">
              The decisions that shaped the product.
            </h2>
          </div>
          <ol className="project-approach__list">
            {project.approach.map((item, index) => (
              <li className="project-approach__entry" key={item}>
                <Reveal
                  className="project-approach__item"
                  delay={index * 0.05}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="project-chapters"
          aria-labelledby="project-chapters-title"
        >
          <div className="section-heading">
            <p className="eyebrow">Product details</p>
            <h2 id="project-chapters-title">Three parts of the system in detail.</h2>
          </div>
          <div className="project-chapters__grid">
            {project.chapters.map((chapter, index) => (
              <Reveal
                className="project-chapter"
                delay={index * 0.07}
                key={chapter.title}
              >
                <p className="project-chapter__eyebrow">{chapter.eyebrow}</p>
                <h3>{chapter.title}</h3>
                <p>{chapter.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {relatedProjects.length > 0 && (
          <section
            className="related-work"
            aria-labelledby="related-work-title"
          >
            <div className="section-heading section-heading--split">
              <p className="eyebrow">More work</p>
              <h2 id="related-work-title">Related work</h2>
            </div>
            <div className="related-work__grid">
              {relatedProjects.map((relatedProject) => (
                <RelatedProjectCard
                  project={relatedProject}
                  key={relatedProject.slug}
                />
              ))}
            </div>
          </section>
        )}

        <footer className="next-project">
          <p className="eyebrow">Next project</p>
          <Link href={`/work/${nextProject.slug}`}>
            <span>{nextProject.title}</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </footer>
      </article>
    </main>
  );
}
