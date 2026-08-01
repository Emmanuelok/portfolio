import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { MediaPostCard } from "@/components/MediaPostCard";
import { Reveal } from "@/components/Reveal";
import { mediaPosts } from "@/data/media";

export const metadata: Metadata = {
  title: "Media",
  description:
    "kingXford & Co evidence briefings and essays on sustainable abundance, intelligence, research and development, AI, and solving complex problems.",
  alternates: {
    canonical: "/media",
  },
  openGraph: {
    title: "Media — kingXford & Co",
    description:
      "Evidence and ideas for expanding human capability through intelligence, research, AI, and sustainable systems.",
    type: "website",
    url: "/media",
  },
  twitter: {
    card: "summary",
    title: "Media — kingXford & Co",
    description:
      "Evidence briefings on sustainable abundance, intelligence, research, AI, and complex systems.",
  },
};

export default function MediaPage() {
  const topicCount = new Set(mediaPosts.flatMap((post) => post.topics)).size;

  return (
    <main className="page page--media">
      <section
        className="page-hero page-hero--media"
        aria-labelledby="media-heading"
      >
        <div className="page-hero__index" aria-hidden="true">
          04 / Media
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">
              kingXford &amp; Co · Intelligence · Evidence · Abundant futures
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="media-heading">
              <span className="page-hero__line">Intelligence for an</span>
              <span className="page-hero__line page-hero__line--accent">
                abundant future.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            Evidence-led thinking on research and development, trustworthy AI,
            sustainable abundance, and the systems people and institutions need
            to solve consequential problems.
          </p>
          <a className="text-link" href="#latest">
            <span>Read the latest</span>
            <ArrowDownRight aria-hidden="true" />
          </a>
        </Reveal>

        <div className="page-hero__ledger" aria-label="Media summary">
          <span>
            <strong>{String(mediaPosts.length).padStart(2, "0")}</strong>
            Published
          </span>
          <span>
            <strong>{String(topicCount).padStart(2, "0")}</strong>
            Topics
          </span>
          <span>
            <strong>Open</strong>
            Editorial range
          </span>
        </div>
      </section>

      <section
        className="media-index"
        id="latest"
        aria-labelledby="latest-media-title"
      >
        <div className="section-heading section-heading--split">
          <p className="eyebrow">Latest from kingXford &amp; Co</p>
          <h2 id="latest-media-title">
            Complex questions, followed through with evidence.
          </h2>
        </div>

        <div className="media-index__grid">
          {mediaPosts.map((post, index) => (
            <Reveal
              className="media-index__entry"
              delay={Math.min(index * 0.06, 0.18)}
              key={post.slug}
            >
              <MediaPostCard post={post} priority={index === 0} />
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal className="page-cta">
        <p className="eyebrow">A question worth examining?</p>
        <h2>Bring the difficult subject into the room.</h2>
        <Link className="button button--primary" href="/contact">
          <span>Start a conversation</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Reveal>
    </main>
  );
}
