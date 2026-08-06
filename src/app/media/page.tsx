import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { MediaPostCard } from "@/components/MediaPostCard";
import { Reveal } from "@/components/Reveal";
import { mediaPosts } from "@/data/media";

export const metadata: Metadata = {
  title: "Field notes",
  description:
    "kingXford & Co research briefings and practical essays on responsible AI, research and development, and useful systems.",
  alternates: {
    canonical: "/media",
  },
  openGraph: {
    title: "Field notes — kingXford & Co",
    description:
      "Research briefings and practical essays on responsible AI, R&D, and useful systems.",
    type: "website",
    url: "/media",
  },
  twitter: {
    card: "summary",
    title: "Field notes — kingXford & Co",
    description:
      "Research briefings and practical essays from kingXford & Co.",
  },
};

export default function MediaPage() {
  const topicCount = new Set(mediaPosts.flatMap((post) => post.topics)).size;
  const formatCount = new Set(mediaPosts.map((post) => post.format)).size;

  return (
    <main className="page page--media">
      <section
        className="page-hero page-hero--media"
        aria-labelledby="media-heading"
      >
        <div className="page-hero__index" aria-hidden="true">
          Field notes
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">
              kingXford &amp; Co · Research briefings · Practical essays
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="media-heading">
              <span className="page-hero__line">Field notes for</span>
              <span className="page-hero__line page-hero__line--accent">
                difficult decisions.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            Research briefings and essays on responsible AI, R&amp;D,
            sustainable abundance, and the design of useful systems.
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
            <strong>{String(formatCount).padStart(2, "0")}</strong>
            Formats
          </span>
        </div>
      </section>

      <section
        className="media-index"
        id="latest"
        aria-labelledby="latest-media-title"
      >
        <div className="section-heading section-heading--split">
          <p className="eyebrow">Latest field notes</p>
          <h2 id="latest-media-title">
            Research and practical guidance, grounded in evidence.
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
        <p className="eyebrow">Have a question worth examining?</p>
        <h2>Start a research conversation.</h2>
        <Link className="button button--primary" href="/contact">
          <span>Start a conversation</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Reveal>
    </main>
  );
}
