import Link from "next/link";
import {
  ArrowUpRight,
  Boxes,
  DraftingCompass,
  Sparkles,
} from "lucide-react";

import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { StudioScrollStory } from "@/components/StudioScrollStory";
import { WorkGrid } from "@/components/WorkGrid";
import { projects } from "@/data/projects";

const capabilityBands = [
  {
    number: "01",
    title: "Digital products",
    copy: "Useful systems with a point of view—from first decision to final state.",
    icon: Boxes,
  },
  {
    number: "02",
    title: "Visual systems",
    copy: "Identity, image, motion, and interface made to speak one language.",
    icon: Sparkles,
  },
  {
    number: "03",
    title: "Complexity design",
    copy: "Research, data, and difficult ideas translated into visible structure.",
    icon: DraftingCompass,
  },
] as const;

export default function HomePage() {
  const featured = projects.filter((project) => project.featured);

  return (
    <main className="page page--home">
      <Hero />
      <StudioScrollStory />

      <section className="section selected-work" aria-labelledby="selected-title">
        <div className="section__heading">
          <Reveal>
            <div className="section__eyebrow">
              <span>Selected systems</span>
              <span aria-hidden="true">08 / ∞</span>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="section__title-row">
              <h2 id="selected-title">
                Work built to be
                <em> entered, not observed.</em>
              </h2>
              <p>
                A selection of intelligent products, research platforms, and
                visual worlds—each shaped around a real decision people need to
                make.
              </p>
            </div>
          </Reveal>
        </div>

        <WorkGrid
          items={featured}
          showLens={false}
          limit={4}
          className="work-grid--home"
        />

        <Reveal className="selected-work__all">
          <Link href="/work" className="text-link text-link--large">
            <span>Enter the complete archive</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Reveal>
      </section>

      <section className="section capability-section" aria-labelledby="capability-title">
        <div className="section__heading">
          <Reveal>
            <div className="section__eyebrow">
              <span>Practice</span>
              <span>One connected discipline</span>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="capability-section__title" id="capability-title">
              Strategy with texture.
              <br />
              Technology with a pulse.
            </h2>
          </Reveal>
        </div>

        <div className="capability-list">
          {capabilityBands.map((capability, index) => {
            const Icon = capability.icon;
            return (
              <Reveal
                className="capability-item"
                delay={index * 0.07}
                key={capability.number}
              >
                <div className="capability-item__number">
                  <span>{capability.number}</span>
                  <Icon aria-hidden="true" />
                </div>
                <h3>{capability.title}</h3>
                <p>{capability.copy}</p>
                <span className="capability-item__thread" aria-hidden="true" />
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="lab-window" aria-labelledby="lab-window-title">
        <div className="lab-window__visual" aria-hidden="true">
          <div className="lab-orbit lab-orbit--one" />
          <div className="lab-orbit lab-orbit--two" />
          <div className="lab-orbit lab-orbit--three" />
          <div className="lab-window__core">K</div>
          <span className="lab-window__coordinate lab-window__coordinate--one">
            x.056
          </span>
          <span className="lab-window__coordinate lab-window__coordinate--two">
            y.419
          </span>
        </div>
        <div className="lab-window__copy">
          <Reveal>
            <span className="lab-window__eyebrow">
              Kingxford Lab · Experimental wing
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h2 id="lab-window-title">Some ideas need room to misbehave.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p>
              Generative marks, motion studies, spatial interfaces, and visual
              provocations—small experiments that keep the larger work alive.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <Link href="/lab" className="button button--primary">
              <span>Open the lab</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="home-finale" aria-labelledby="home-finale-title">
        <div className="home-finale__noise" aria-hidden="true" />
        <Reveal className="home-finale__meta">
          <span>Have a difficult idea?</span>
          <span>Good. Those are the interesting ones.</span>
        </Reveal>
        <Reveal>
          <h2 id="home-finale-title">
            Let&apos;s give it
            <em> unforgettable form.</em>
          </h2>
        </Reveal>
        <Reveal className="home-finale__action" delay={0.08}>
          <Link href="/contact" className="circle-link">
            <span>Start a project</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
