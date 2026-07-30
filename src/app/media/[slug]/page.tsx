import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Headphones,
} from "lucide-react";

import { Reveal } from "@/components/Reveal";
import {
  getMediaPostBySlug,
  mediaPosts,
  type MediaPost,
} from "@/data/media";

type MediaArticlePageProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://my-portfolio-six-teal-90.vercel.app"
).replace(/\/$/, "");

export const dynamicParams = false;

export function generateStaticParams() {
  return mediaPosts.map((post) => ({ slug: post.slug }));
}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

export async function generateMetadata({
  params,
}: MediaArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getMediaPostBySlug(slug);

  if (!post) {
    return {
      title: "Media post not found",
      robots: { index: false, follow: false },
    };
  }

  const canonical = `/media/${post.slug}`;
  const coverUrl = `${siteUrl}${post.cover}`;

  return {
    title: post.title,
    description: post.description,
    keywords: [...post.topics],
    alternates: { canonical },
    openGraph: {
      title: `${post.title} — Kingxford`,
      description: post.description,
      type: "article",
      url: canonical,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: ["Kingxford"],
      tags: [...post.topics],
      images: [
        {
          url: coverUrl,
          width: 2400,
          height: 1600,
          alt: post.coverAlt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} — Kingxford`,
      description: post.description,
      images: [coverUrl],
    },
  };
}

function AudioEdition({ post }: Readonly<{ post: MediaPost }>) {
  if (!post.audio) return null;

  return (
    <section
      className="media-audio"
      aria-labelledby={`${post.slug}-audio-title`}
    >
      <div className="media-audio__heading">
        <Headphones aria-hidden="true" />
        <div>
          <p className="eyebrow">Narrated edition</p>
          <h2 id={`${post.slug}-audio-title`}>Listen to this field note</h2>
        </div>
      </div>
      <p>
        Narrated by {post.audio.narrator} · {post.audio.durationLabel}. The
        complete text version follows below.
      </p>
      <audio
        controls
        preload="metadata"
        aria-label={`Listen to ${post.title}`}
      >
        <source src={post.audio.src} type={post.audio.mimeType} />
        Your browser cannot play this audio.{" "}
        <a href={post.audio.src}>Open the audio file</a>.
      </audio>
    </section>
  );
}

export default async function MediaArticlePage({
  params,
}: MediaArticlePageProps) {
  const { slug } = await params;
  const post = getMediaPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const postIndex = mediaPosts.findIndex((item) => item.slug === post.slug);
  const nextPost = mediaPosts[(postIndex + 1) % mediaPosts.length];
  const canonicalUrl = `${siteUrl}/media/${post.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    image: [`${siteUrl}${post.cover}`],
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    articleSection: post.topics,
    keywords: post.topics.join(", "),
    isAccessibleForFree: true,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    author: {
      "@type": "Organization",
      name: "Kingxford",
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Kingxford",
      url: siteUrl,
    },
  };

  return (
    <main className="page page--media-article">
      <article className="media-article">
        <script
          id={`article-schema-${post.slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />

        <header className="media-article__hero">
          <div className="media-article__nav">
            <Link className="text-link" href="/media">
              <ArrowLeft aria-hidden="true" />
              <span>All media</span>
            </Link>
            <span>
              {post.format} / {post.readingLabel}
            </span>
          </div>

          <div className="media-article__heading">
            <Reveal>
              <p className="eyebrow">{post.eyebrow}</p>
            </Reveal>
            <Reveal distance={48}>
              <h1>{post.title}</h1>
            </Reveal>
            <Reveal className="media-article__standfirst" delay={0.08}>
              <p>{post.standfirst}</p>
            </Reveal>
          </div>

          <Reveal className="media-article__meta" delay={0.12}>
            <div>
              <p className="meta-label">Published</p>
              <time dateTime={post.publishedAt}>
                {formatPublishedDate(post.publishedAt)}
              </time>
            </div>
            <div>
              <p className="meta-label">By</p>
              <p>Kingxford</p>
            </div>
            <div>
              <p className="meta-label">Topics</p>
              <p>{post.topics.join(" · ")}</p>
            </div>
          </Reveal>

          <Reveal className="media-article__cover" amount={0.08}>
            <figure>
              <Image
                src={post.cover}
                alt={post.coverAlt}
                width={2400}
                height={1600}
                quality={94}
                sizes="100vw"
                priority
              />
              <figcaption>
                Conceptual editorial imagery · Illustrative, not documentary
                evidence
              </figcaption>
            </figure>
          </Reveal>
        </header>

        <AudioEdition post={post} />

        <div className="media-article__layout">
          <aside className="media-article__rail">
            <nav aria-label="On this page">
              <p className="eyebrow">On this page</p>
              <ol>
                {post.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.title}</a>
                  </li>
                ))}
                <li>
                  <a href="#thirty-day-plan">A practical 30-day plan</a>
                </li>
                <li>
                  <a href="#research-notes">Research notes</a>
                </li>
              </ol>
            </nav>
          </aside>

          <div className="media-article__body">
            <section
              className="media-article__introduction"
              aria-label="Introduction"
            >
              {post.introduction.map((paragraph, index) => (
                <p
                  className={index === 0 ? "media-article__lede" : undefined}
                  key={paragraph}
                >
                  {paragraph}
                </p>
              ))}
            </section>

            {post.sections.map((section) => (
              <section
                className="media-article__section"
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                key={section.id}
              >
                <p className="eyebrow">{section.eyebrow}</p>
                <h2 id={`${section.id}-title`}>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}

                {section.principles ? (
                  <div
                    className="media-principles"
                    aria-label={`${section.title} principles`}
                  >
                    {section.principles.map((principle, index) => (
                      <div className="media-principle" key={principle.title}>
                        <span aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <h3>{principle.title}</h3>
                        <p>{principle.body}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}

            <section
              className="media-article__section media-plan"
              id="thirty-day-plan"
              aria-labelledby="thirty-day-plan-title"
            >
              <p className="eyebrow">05 · Practice</p>
              <h2 id="thirty-day-plan-title">A practical 30-day plan.</h2>
              <p>
                The plan begins with one real workflow. It is deliberately
                narrow: learn enough from a complete cycle to build the next
                one intelligently.
              </p>

              <ol className="media-plan__stages">
                {post.plan.map((stage) => (
                  <li className="media-plan__stage" key={stage.range}>
                    <div className="media-plan__heading">
                      <span>{stage.range}</span>
                      <h3>{stage.title}</h3>
                    </div>
                    <p>{stage.focus}</p>
                    <ul>
                      {stage.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                    <p className="media-plan__result">
                      <strong>Result:</strong> {stage.result}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section
              className="media-article__closing"
              aria-labelledby="media-closing-title"
            >
              <p className="eyebrow">Closing note</p>
              <h2 id="media-closing-title">Capability with accountability.</h2>
              {post.closing.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>

            <section
              className="media-article__section media-sources"
              id="research-notes"
              aria-labelledby="research-notes-title"
            >
              <p className="eyebrow">Research notes</p>
              <h2 id="research-notes-title">Sources for going deeper.</h2>
              <p>
                This field note is an original Kingxford perspective. These
                primary and institutional sources helped ground its wider
                context.
              </p>
              <ul>
                {post.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>
                        <strong>{source.title}</strong>
                        <small>{source.organization}</small>
                      </span>
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                    <p>{source.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <footer className="media-article__footer">
          <div>
            <p className="eyebrow">Continue the conversation</p>
            <h2>What part of your work deserves a better system?</h2>
            <Link className="button button--primary" href="/contact">
              <span>Bring it to Kingxford</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>

          <Link
            className="media-article__next"
            href={`/media/${nextPost.slug}`}
            aria-label={`Read next: ${nextPost.title}`}
          >
            <span>
              {mediaPosts.length === 1 ? "Read again" : "Read next"}
            </span>
            <strong>{nextPost.title}</strong>
            <ArrowRight aria-hidden="true" />
          </Link>
        </footer>
      </article>
    </main>
  );
}
