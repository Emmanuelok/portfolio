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
    kicker: "Digital creation",
    statement: "Ideas become experiences.",
    body:
      "We design and build intelligent tools, web apps, websites, digital products, cinematic worlds, and motion-led visual systems.",
    signature: "From first strategy to live release.",
    services: [
      "Digital tools & platforms",
      "Web apps & websites",
      "Product & experience design",
      "Cinematography & motion",
      "Brand & visual systems",
      "Digital development",
    ],
    image: "/motion/kingxford-reality-studio-portrait.webp",
    href: "/work",
    cta: "Enter Studio",
  },
  {
    id: "living-room",
    number: "02",
    title: "The Living Room",
    kicker: "Open-ended practice",
    statement: "For the brief that refuses a category.",
    body:
      "One-off commissions, new service ideas, creative strategy, experiences, and collaborations shaped around the real need.",
    signature: "No fixed menu. Unending possibilities.",
    services: [
      "Special commissions",
      "Strategy & concepts",
      "Experiences",
      "New service ideas",
      "Cross-disciplinary collaboration",
      "The useful unknown",
    ],
    image: "/motion/kingxford-reality-living-room-portrait.webp",
    href: "/contact?world=living-room",
    cta: "Bring something different",
  },
  {
    id: "lab",
    number: "03",
    title: "Lab",
    kicker: "Science & academia",
    statement: "Rigour, made legible.",
    body:
      "For researchers, educators, institutions, and scientific teams turning difficult knowledge into systems people can explore and use.",
    signature: "Depth without obscurity.",
    services: [
      "Research platforms",
      "Academic visualisation",
      "Data & knowledge systems",
      "Publication design",
      "Learning experiences",
      "Scientific communication",
    ],
    image: "/motion/kingxford-reality-lab-portrait.webp",
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
          <span>01 / Three worlds</span>
          <span>Choose the room the idea needs</span>
        </div>
        <div className="worlds__heading">
          <h2 id="worlds-title">
            Three doors.
            <em>One exacting practice.</em>
          </h2>
          <p>
            Every Kingxford engagement begins in one of three worlds. The
            boundaries are clear; the possibilities inside them are not.
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
  "A web app for a difficult workflow",
  "A strange commission with no category",
  "A research platform for scientific evidence",
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
        <span>02 / The idea router</span>
        <h2 id="idea-router-title">
          What are you trying
          <em>to bring into form?</em>
        </h2>
        <p>
          Describe it plainly. Kingxford will point you toward the room best
          equipped to begin.
        </p>
      </div>

      <div className="idea-router__console">
        <label htmlFor="idea-router-input">Your idea, in one sentence</label>
        <div className="idea-router__input">
          <textarea
            id="idea-router-input"
            value={idea}
            rows={3}
            placeholder="I need to turn…"
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
