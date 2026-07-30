import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { MediaPostCard } from "@/components/MediaPostCard";
import { Reveal } from "@/components/Reveal";
import { mediaPosts } from "@/data/media";

export const metadata: Metadata = {
  title: "Media",
  description:
    "Kingxford field notes, essays, briefings, and future conversations on artificial intelligence, business, finance, design, research, and the changing shape of work.",
  alternates: {
    canonical: "/media",
  },
  openGraph: {
    title: "Media — Kingxford",
    description:
      "Ideas for thinking clearly and building responsibly through technological and economic change.",
    type: "website",
    url: "/media",
  },
  twitter: {
    card: "summary",
    title: "Media — Kingxford",
    description:
      "Field notes and briefings on AI, business, finance, design, research, and work.",
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
              Kingxford · Field notes · Essays · Conversations
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="media-heading">
              <span className="page-hero__line">Ideas for the world</span>
              <span className="page-hero__line page-hero__line--accent">
                that is taking shape.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            Clear thinking on artificial intelligence, business, finance,
            design, research, and the practical work of moving ahead without
            losing judgement.
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
          <p className="eyebrow">Latest from Kingxford</p>
          <h2 id="latest-media-title">
            Useful ideas, followed all the way through.
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
