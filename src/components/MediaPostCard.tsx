import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ProjectCaptureAction } from "@/components/platform/ProjectCaptureAction";
import type { MediaPost } from "@/data/media";

type MediaPostCardProps = Readonly<{
  post: MediaPost;
  priority?: boolean;
}>;

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

export function MediaPostCard({
  post,
  priority = false,
}: MediaPostCardProps) {
  return (
    <article
      className={
        post.featured ? "media-card media-card--featured" : "media-card"
      }
    >
      <Link
        className="media-card__link"
        href={`/media/${post.slug}`}
        aria-label={`Read ${post.title}`}
      >
        <figure className="media-card__media">
          <Image
            className="media-card__image"
            src={post.cover}
            alt={post.coverAlt}
            width={post.coverWidth ?? 2400}
            height={post.coverHeight ?? 1600}
            quality={94}
            priority={priority}
            sizes="(max-width: 760px) 100vw, 88vw"
          />
          <figcaption>Illustrative editorial image</figcaption>
        </figure>

        <div className="media-card__body">
          <div className="media-card__meta">
            <span>{post.format}</span>
            <span aria-hidden="true">/</span>
            <time dateTime={post.publishedAt}>
              {formatPublishedDate(post.publishedAt)}
            </time>
            <span aria-hidden="true">/</span>
            <span>{post.readingLabel}</span>
          </div>
          <h2>{post.title}</h2>
          <p>{post.description}</p>
          <div className="media-card__footer">
            <ul aria-label={`${post.title} topics`}>
              {post.topics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
            <span className="media-card__read">
              Read article
              <ArrowUpRight aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
      <div className="media-card__capture">
        <ProjectCaptureAction
          compact
          title={post.title}
          claim={post.description}
          referenceHref={`/media/${post.slug}`}
          source="media"
        />
      </div>
    </article>
  );
}
