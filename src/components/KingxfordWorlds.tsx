"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CornerDownLeft } from "lucide-react";
import {
  useDeferredValue,
  useMemo,
  useState,
} from "react";

type WorldId = "studio" | "living-room" | "lab";

type World = Readonly<{
  id: WorldId;
  number: string;
  title: string;
  kicker: string;
  statement: string;
  body: string;
  signature: string;
  services: readonly string[];
  image: string;
  href: string;
  cta: string;
}>;

const worlds: readonly World[] = [
  {
    id: "studio",
    number: "01",
    title: "Studio",
    kicker: "Product & digital systems",
    statement: "Build intelligence into useful systems.",
    body:
      "The Studio translates research and strategic insight into intelligent tools, platforms, products, and experiences people can put to work.",
    signature: "From validated proposition to resilient release.",
    services: [
      "Intelligent tools & platforms",
      "AI-enabled products",
      "Decision-support systems",
      "Product & service design",
      "Web apps & digital infrastructure",
      "Communication & visual systems",
    ],
    image: "/motion/kingxford-production-spine-v2.webp",
    href: "/work",
    cta: "Enter Studio",
  },
  {
    id: "living-room",
    number: "02",
    title: "The Living Room",
    kicker: "Strategy & complex mandates",
    statement: "Solve the problem before it hardens.",
    body:
      "The Living Room is our situation room for institutions, collaborators, and uncommon briefs that need structured intelligence before they need a predefined service.",
    signature: "The right coalition around the real question.",
    services: [
      "Strategic intelligence",
      "Complex problem framing",
      "Foresight & scenario work",
      "Institutional transformation",
      "Venture & project development",
      "Cross-disciplinary coalitions",
    ],
    image: "/motion/kingxford-decision-theatre-v2.webp",
    href: "/contact?world=living-room",
    cta: "Bring something different",
  },
  {
    id: "lab",
    number: "03",
    title: "Lab",
    kicker: "Research & development",
    statement: "Make uncertainty testable.",
    body:
      "The Lab conducts and translates rigorous inquiry for scientific, academic, public-interest, and industry partners developing knowledge with consequence.",
    signature: "Evidence that can travel into action.",
    services: [
      "Applied research & experimentation",
      "Responsible AI evaluation",
      "Data & knowledge systems",
      "Research platforms",
      "Evidence synthesis & translation",
      "Scientific communication",
    ],
    image: "/motion/kingxford-instrument-corridor-v2.webp",
    href: "/lab",
    cta: "Enter Lab",
  },
] as const;

const intentVocabulary: Record<WorldId, readonly string[]> = {
  studio: [
    "app",
    "website",
    "web",
    "digital",
    "product",
    "tool",
    "software",
    "platform",
    "brand",
    "identity",
    "graphic",
    "interface",
    "motion",
    "film",
    "cinematography",
    "video",
    "design system",
    "prototype",
    "automation",
    "decision support",
  ],
  "living-room": [
    "campaign",
    "event",
    "experience",
    "story",
    "strategy",
    "commission",
    "collaboration",
    "installation",
    "idea",
    "unusual",
    "different",
    "unsure",
    "institution",
    "foresight",
    "scenario",
    "transformation",
    "venture",
    "project development",
  ],
  lab: [
    "research",
    "academic",
    "science",
    "scientific",
    "data",
    "paper",
    "publication",
    "university",
    "thesis",
    "evidence",
    "ontology",
    "diagram",
    "knowledge",
    "learning",
    "education",
    "development",
    "experiment",
    "responsible ai",
    "sustainable",
    "abundance",
  ],
};

export function KingxfordWorlds() {
  const [activeWorld, setActiveWorld] = useState<WorldId>("studio");

  return (
    <section
      className="worlds"
      id="three-worlds"
      aria-labelledby="worlds-title"
    >
      <header className="worlds__header">
        <div className="worlds__index">
          <span>01 / Delivery environments</span>
          <span>One mission, three modes of work</span>
        </div>
        <div className="worlds__heading">
          <h2 id="worlds-title">
            One mission.
            <em>Three delivery environments.</em>
          </h2>
          <p>
            Intelligence, R&amp;D, responsible AI, and preparation for sustainable
            abundance lead the work. Studio, The Living Room, and Lab are the
            environments through which kingXford &amp; Co delivers it.
          </p>
        </div>
      </header>

      <div className="worlds__portal">
        {worlds.map((world) => (
          <article
            className="world-panel"
            id={world.id}
            data-active={activeWorld === world.id ? "true" : "false"}
            onMouseEnter={() => setActiveWorld(world.id)}
            onFocusCapture={() => setActiveWorld(world.id)}
            onClick={() => setActiveWorld(world.id)}
            key={world.id}
          >
            <Image
              className="world-panel__image"
              src={world.image}
              alt=""
              fill
              quality={94}
              sizes="(max-width: 760px) 100vw, 48vw"
            />
            <span className="world-panel__scrim" aria-hidden="true" />
            <div className="world-panel__topline">
              <span>{world.number}</span>
              <span>{world.kicker}</span>
            </div>
            <div className="world-panel__body">
              <p>{world.title}</p>
              <h3>{world.statement}</h3>
              <div className="world-panel__reveal">
                <p>{world.body}</p>
                <p className="world-panel__signature">{world.signature}</p>
                <ul aria-label={`${world.title} services`}>
                  {world.services.map((service) => (
                    <li key={service}>{service}</li>
                  ))}
                </ul>
              </div>
            </div>
            <Link
              className="world-panel__link"
              href={world.href}
              aria-label={`${world.cta}: ${world.statement}`}
            >
              <span>{world.cta}</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </article>
        ))}
        <span className="worlds__x worlds__x--one" aria-hidden="true" />
        <span className="worlds__x worlds__x--two" aria-hidden="true" />
      </div>
    </section>
  );
}

function scoreIntent(value: string) {
  const normalized = value.toLocaleLowerCase();
  const scores = (Object.keys(intentVocabulary) as WorldId[]).map((id) => ({
    id,
    score: intentVocabulary[id].reduce(
      (total, term) => total + (normalized.includes(term) ? 1 : 0),
      0,
    ),
  }));
  scores.sort((a, b) => b.score - a.score);

  if (scores[0].score === 0) return worlds[1];
  if (
    scores[0].score === scores[1].score &&
    scores[0].id !== "living-room"
  ) {
    return worlds[1];
  }
  return worlds.find((world) => world.id === scores[0].id) ?? worlds[1];
}

const ideaPrompts = [
  "An intelligent system for a difficult workflow",
  "A complex institutional challenge with no obvious owner",
  "A research programme for sustainable abundance",
] as const;

export function IdeaRouter() {
  const [idea, setIdea] = useState("");
  const deferredIdea = useDeferredValue(idea);
  const recommendation = useMemo(
    () => scoreIntent(deferredIdea),
    [deferredIdea],
  );
  const hasIdea = deferredIdea.trim().length > 2;

  return (
    <section
      className="idea-router"
      aria-labelledby="idea-router-title"
    >
      <div className="idea-router__intro">
        <span>02 / The complexity router</span>
        <h2 id="idea-router-title">
          What future are you trying
          <em>to make possible?</em>
        </h2>
        <p>
          Describe the problem, idea, or project plainly. kingXford &amp; Co will
          point you toward the delivery environment best equipped to begin.
        </p>
      </div>

      <div className="idea-router__console">
        <label htmlFor="idea-router-input">
          Your problem, idea, or project in one sentence
        </label>
        <div className="idea-router__input">
          <textarea
            id="idea-router-input"
            value={idea}
            rows={3}
            placeholder="We need to understand, develop, or build…"
            onChange={(event) => setIdea(event.target.value)}
          />
          <CornerDownLeft aria-hidden="true" />
        </div>

        {!hasIdea && (
          <div className="idea-router__prompts" aria-label="Example ideas">
            {ideaPrompts.map((prompt) => (
              <button
                type="button"
                onClick={() => setIdea(prompt)}
                key={prompt}
              >
                <ArrowRight aria-hidden="true" />
                {prompt}
              </button>
            ))}
          </div>
        )}

        {hasIdea && (
          <div
            className="idea-router__result"
            aria-live="polite"
            data-world={recommendation.id}
          >
            <div>
              <span>Recommended room</span>
              <strong>{recommendation.title}</strong>
            </div>
            <p>{recommendation.body}</p>
            <Link href={recommendation.href}>
              {recommendation.cta}
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
