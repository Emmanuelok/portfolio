"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, CornerDownLeft } from "lucide-react";
import {
  useDeferredValue,
  useMemo,
  useState,
} from "react";

import {
  PLATFORM_SEED_INPUT_LIMIT,
  createPlatformSeed,
  writePlatformSeed,
} from "@/lib/platform/seed";

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
    statement: "Turn a defined need into a working product.",
    body:
      "Studio combines research, product strategy, design, and development to build tools, platforms, and digital services people can use.",
    signature: "From tested proposition to supported release.",
    services: [
      "Digital tools & platforms",
      "AI-enabled products",
      "Decision-support systems",
      "Product & service design",
      "Web apps & digital infrastructure",
      "Communication & visual systems",
    ],
    image: "/motion/kingxford-production-spine-v2.webp",
    href: "/create",
    cta: "Enter Studio",
  },
  {
    id: "living-room",
    number: "02",
    title: "The Living Room",
    kicker: "Strategy & complex mandates",
    statement: "Solve the problem before it hardens.",
    body:
      "The Living Room helps institutions and collaborators frame unusual or cross-disciplinary briefs before choosing a service or solution.",
    signature: "Define the question, then assemble the right contributors.",
    services: [
      "Strategy & decision support",
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
      "The Lab conducts and translates research for scientific, academic, public-interest, and industry partners.",
    signature: "Evidence prepared for decisions and delivery.",
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
          <span>01 / Ways to work with kingXford</span>
          <span>Studio · The Living Room · Lab</span>
        </div>
        <div className="worlds__heading">
          <h2 id="worlds-title">
            One practice.
            <em>Three ways to begin.</em>
          </h2>
          <p>
            Use Studio for product delivery, The Living Room for problem
            framing, and Lab for research and evaluation.
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
  "An AI-assisted tool for a difficult workflow",
  "An institutional challenge with no clear owner",
  "A research programme with defined questions and evidence needs",
] as const;

export function IdeaRouter() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [status, setStatus] = useState("");
  const deferredIdea = useDeferredValue(idea);
  const recommendation = useMemo(
    () => scoreIntent(deferredIdea),
    [deferredIdea],
  );
  const hasIdea = deferredIdea.trim().length > 2;

  const startProject = () => {
    const input = idea.trim();
    if (input.length < 3) return;
    try {
      const seed = createPlatformSeed(input, {
        phase: "discovery",
        mode: "idea",
        source: "idea-router",
      });
      const saved = writePlatformSeed(window.sessionStorage, seed);
      if (!saved.ok) {
        setStatus("This browser could not prepare the private project start. Your words were not sent anywhere.");
        return;
      }
      setStatus("Project start saved in this browser tab. Opening Canvas…");
      router.push("/create/workspace?start=seed&phase=discovery&mode=idea");
    } catch {
      setStatus("This project could not be prepared safely. Your words were not sent anywhere.");
    }
  };

  return (
    <section
      className="idea-router"
      aria-labelledby="idea-router-title"
    >
      <div className="idea-router__intro">
        <span>02 / Find a starting point</span>
        <h2 id="idea-router-title">
          What are you trying to understand,
          <em>improve, or build?</em>
        </h2>
        <p>
          Describe it in plain language. This local router suggests a starting
          environment and carries your exact words into Canvas without
          contacting an AI service.
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
            maxLength={PLATFORM_SEED_INPUT_LIMIT}
            placeholder="We need to understand, develop, or build…"
            onChange={(event) => {
              setIdea(event.target.value);
              setStatus("");
            }}
          />
          <CornerDownLeft aria-hidden="true" />
        </div>
        <p className="idea-router__count">
          {idea.length.toLocaleString()} / {PLATFORM_SEED_INPUT_LIMIT.toLocaleString()}
        </p>

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
              <span>Suggested starting point</span>
              <strong>{recommendation.title}</strong>
            </div>
            <p>{recommendation.body}</p>
            <button type="button" onClick={startProject}>
              Start this project
              <ArrowUpRight aria-hidden="true" />
            </button>
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">{status}</p>
      </div>
    </section>
  );
}
