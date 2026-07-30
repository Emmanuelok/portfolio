import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Github, MapPin } from "lucide-react";

import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Start a collaboration with Kingxford and Emmanuel Kingsford Owusu across product design, visual systems, research experiences, and intelligent platforms.",
  alternates: {
    canonical: "/contact",
  },
};

const githubUrl = "https://github.com/Emmanuelok";

const usefulDetails = [
  "What you are making—and why it needs to exist",
  "Who the experience is for",
  "What feels difficult, unclear, or unresolved",
  "Your ideal timing and the shape of collaboration",
] as const;

export default function ContactPage() {
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
              Kingxford · Selected collaborations
            </p>
          </Reveal>
          <Reveal distance={48}>
            <h1 className="page-hero__title" id="contact-heading">
              <span className="page-hero__line">Bring the problem</span>
              <span className="page-hero__line page-hero__line--accent">
                that refuses to be ordinary.
              </span>
            </h1>
          </Reveal>
        </div>

        <Reveal className="page-hero__aside" delay={0.16}>
          <p>
            I am open to ambitious digital products, visual systems, research
            experiences, intelligent platforms, and creative partnerships
            where the thinking matters as much as the finish.
          </p>
        </Reveal>
      </section>

      <section
        className="contact-stage"
        aria-labelledby="contact-stage-heading"
      >
        <Reveal className="contact-stage__primary">
          <p className="eyebrow">The public channel</p>
          <h2 id="contact-stage-heading">
            Tell me what you are trying to change.
          </h2>
          <a
            className="contact-email"
            href={githubUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span>Connect on GitHub</span>
            <ArrowUpRight aria-hidden="true" />
          </a>
          <p className="contact-stage__note">
            A clear first note is enough. Contact details are available from
            the public profile when you are ready to begin.
          </p>
        </Reveal>

        <Reveal className="contact-stage__details" delay={0.08}>
          <div className="contact-detail">
            <MapPin aria-hidden="true" />
            <div>
              <p className="meta-label">Base</p>
              <p>Canada</p>
              <p>Working across borders and time zones</p>
            </div>
          </div>
          <div className="contact-detail">
            <Github aria-hidden="true" />
            <div>
              <p className="meta-label">Public profile & repositories</p>
              <a
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
              >
                github.com/Emmanuelok
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="brief-guide" aria-labelledby="brief-guide-heading">
        <div className="section-heading section-heading--split">
          <p className="eyebrow">A useful opening note</p>
          <h2 id="brief-guide-heading">
            Four details that help us get to the real conversation faster.
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
        <p className="eyebrow">Not ready to write yet?</p>
        <h2>Start with the work. Follow the thread that feels closest.</h2>
        <Link className="button button--quiet" href="/work">
          <span>Explore selected projects</span>
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Reveal>
    </main>
  );
}
