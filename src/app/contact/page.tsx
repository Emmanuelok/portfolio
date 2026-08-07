import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { ProjectBriefBuilder } from "@/components/ProjectBriefBuilder";
import { Reveal } from "@/components/Reveal";
import { getContactDeliveryReadiness } from "@/lib/contact/configuration";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Prepare a clear project brief for research, digital product development, responsible AI, or institutional systems work with kingXford & Co.",
  alternates: {
    canonical: "/contact",
  },
};

const usefulDetails = [
  "The problem, opportunity, or future you are trying to shape",
  "The people and institutions affected by the current system",
  "The evidence already available—and the important unknowns",
  "The resources available: budget, knowledge, time, infrastructure, networks, or trust",
] as const;

export default function ContactPage() {
  const delivery = getContactDeliveryReadiness();
  return (
    <main className="page page--contact">
      <section
        className="page-hero page-hero--contact"
        aria-labelledby="contact-heading"
      >
        <div className="page-hero__index" aria-hidden="true">
          Contact
        </div>

        <div className="page-hero__content">
          <Reveal>
            <p className="eyebrow">
              kingXford &amp; Co · Project enquiries
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="contact-heading">
              <span className="page-hero__line">Bring the problem.</span>
              <span className="page-hero__line page-hero__line--accent">
                Leave with a clearer brief.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            Prepare a rigorous brief, submit it through the secure project inbox
            when available, or keep complete control through email, copy, and
            download.
          </p>
        </Reveal>
      </section>

      <ProjectBriefBuilder
        contactEmail={delivery.publicEmail}
        onlineSubmissionAvailable={delivery.configured}
        onlineSubmissionDurable={delivery.abuseProtection.durable}
      />

      <section className="brief-guide" aria-labelledby="brief-guide-heading">
        <div className="section-heading section-heading--split">
          <p className="eyebrow">Before a project begins</p>
          <h2 id="brief-guide-heading">
            Four details that make a first conversation useful.
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
        <h2>Read how research and design inform working products.</h2>
        <Link className="button button--quiet" href="/media">
          <span>Read the field notes</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Reveal>
    </main>
  );
}
