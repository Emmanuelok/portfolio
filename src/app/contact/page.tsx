import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ProjectBriefBuilder } from "@/components/ProjectBriefBuilder";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Frame a complex problem for intelligence, research and development, responsible AI, and long-horizon project delivery with kingXford & Co.",
  alternates: {
    canonical: "/contact",
  },
};

const usefulDetails = [
  "The problem, opportunity, or future you are trying to shape",
  "The people and institutions affected by the current system",
  "The evidence already available—and the important unknowns",
  "The forms of investment available: capital, knowledge, time, infrastructure, networks, or trust",
] as const;

function configuredContactEmail() {
  const value = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

export default function ContactPage() {
  const contactEmail = configuredContactEmail();
  return (
    <main className="page page--contact">
      <section
        className="page-hero page-hero--contact"
        aria-labelledby="contact-heading"
      >
        <div className="page-hero__index" aria-hidden="true">
          04 / Contact
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">
              kingXford &amp; Co · Complex problems · Ambitious futures
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="contact-heading">
              <span className="page-hero__line">Bring the complex problem.</span>
              <span className="page-hero__line page-hero__line--accent">
                Build the future it demands.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            We work with people and institutions developing difficult ideas,
            intelligent systems, research programmes, responsible AI, and
            projects that can expand sustainable human capability.
          </p>
        </Reveal>
      </section>

      <ProjectBriefBuilder contactEmail={contactEmail} />

      <section className="brief-guide" aria-labelledby="brief-guide-heading">
        <div className="section-heading section-heading--split">
          <p className="eyebrow">Before a programme begins</p>
          <h2 id="brief-guide-heading">
            Four questions that protect ambitious work from a shallow start.
          </h2>
        </div>
        <ol className="brief-guide__list">
          {usefulDetails.map((detail, index) => (
            <li className="brief-guide__entry" key={detail}>
              <Reveal className="brief-guide__item" delay={index * 0.05}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{detail}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <Reveal className="contact-close">
        <p className="eyebrow">Continue exploring</p>
        <h2>See how intelligence, research, and development become usable systems.</h2>
        <Link className="button button--quiet" href="/media">
          <span>Read the latest thinking</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Reveal>
    </main>
  );
}
