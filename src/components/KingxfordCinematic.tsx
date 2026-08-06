"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import {
  m,
  type MotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useRef, useState, useSyncExternalStore } from "react";

import { KingxfordLogo } from "@/components/KingxfordLogo";
import { LoomCanvas } from "@/components/LoomCanvas";

type Proof = Readonly<{
  src: string;
  label: string;
}>;

type CinematicChapter = Readonly<{
  id: string;
  label: string;
  index: string;
  range: readonly [number, number];
  eyebrow: string;
  title: string;
  body: string;
  align?: "start" | "end";
  image: string;
  imageAlt: string;
  evidence: string;
  proofs?: readonly Proof[];
}>;

const missionImage = "/motion/kingxford-prototype-documentary.webp";
const intelligenceImage = "/work/value-m-real.webp";
const researchLabImage = "/motion/kingxford-research-lab-v2.webp";
const governanceGateImage =
  "/motion/kingxford-governance-gate-v2.webp";
const signalObservatoryImage =
  "/motion/kingxford-signal-observatory-v2.webp";
const capabilityReactorImage =
  "/motion/kingxford-capability-reactor-v2.webp";

const subscribeToHydration = () => () => {};

function visibilityWindow(
  start: number,
  end: number,
  feather: number,
) {
  if (start === 0) {
    return {
      input: [0, end - feather, end, 1],
      opacity: [1, 1, 0, 0],
      y: [0, 0, -24, -24],
    };
  }

  if (end === 1) {
    return {
      input: [0, start, start + feather, 1],
      opacity: [0, 0, 1, 1],
      y: [34, 34, 0, 0],
    };
  }

  return {
    input: [0, start, start + feather, end - feather, end, 1],
    opacity: [0, 0, 1, 1, 0, 0],
    y: [34, 34, 0, 0, -24, -24],
  };
}

const chapters: readonly CinematicChapter[] = [
  {
    id: "mission",
    label: "Mission",
    index: "00",
    range: [0, 0.18],
    eyebrow: "kingXford & Co / Research, design, and responsible technology",
    title: "Research hard problems. Build useful systems.",
    body:
      "We combine research, product design, development, and responsible AI to help people and institutions make better decisions and deliver complex work.",
    image: missionImage,
    imageAlt:
      "Documentary photograph of a design professional studying a physical model at a working desk",
    evidence: "Mission / Responsible delivery",
  },
  {
    id: "intelligence",
    label: "Decision support",
    index: "01",
    range: [0.17, 0.36],
    eyebrow: "Decision support / From evidence to action",
    title: "See the system before choosing the move.",
    body:
      "We connect evidence, foresight, domain knowledge, and human judgement so teams can compare options and make informed decisions.",
    image: intelligenceImage,
    imageAlt:
      "Documentary photograph of architectural plans, material samples, and a physical scale model used to evaluate a complex design",
    evidence: "Strategy / Systems analysis",
    align: "end",
    proofs: [
      {
        src: "/work/veridanth-evidence-v2.webp",
        label: "Veridanth / Practice",
      },
      {
        src: "/work/grandmaster-evidence-v2.webp",
        label: "GrandMaster / Learning",
      },
    ],
  },
  {
    id: "research-development",
    label: "R&D",
    index: "02",
    range: [0.35, 0.54],
    eyebrow: "Research & development / Questions, evidence, prototypes",
    title: "Turn uncertainty into testable knowledge.",
    body:
      "We investigate difficult questions, build prototypes, evaluate evidence, and translate useful findings into tools, policies, platforms, and ventures that can endure.",
    image: researchLabImage,
    imageAlt:
      "Conceptual editorial image of a scientific laboratory with microscopy, materials testing, and analytical instruments arranged around an optical X",
    evidence: "Scientific inquiry / Applied R&D",
  },
  {
    id: "responsible-ai",
    label: "Responsible AI",
    index: "03",
    range: [0.53, 0.72],
    eyebrow: "Responsible AI / Reviewable by design",
    title: "Build AI-assisted systems people can question and govern.",
    body:
      "We design AI-assisted workflows with visible uncertainty, human review, clear boundaries, and tests matched to the people and institutions affected.",
    image: governanceGateImage,
    imageAlt:
      "Conceptual editorial image of a physical governance gate making the evidence, review, and oversight of AI-assisted systems visible",
    evidence: "Human review / Responsible deployment",
    align: "end",
    proofs: [
      {
        src: "/work/value-m-evidence-v2.webp",
        label: "Value-M / Governance",
      },
      {
        src: "/work/psyche-atlas-evidence-v2.webp",
        label: "Psyche Atlas / Reflection",
      },
    ],
  },
  {
    id: "and-co",
    label: "& Co",
    index: "04",
    range: [0.71, 0.87],
    eyebrow: "Collaboration / Work with accountable owners",
    title: "Bring the right contributors to the same brief.",
    body:
      "We define roles, decisions, and handoffs so contributors can work from shared evidence without losing accountability.",
    image: signalObservatoryImage,
    imageAlt:
      "Conceptual editorial image of a signal observatory where multiple lenses and evidence streams converge through an architectural X",
    evidence: "Collaboration / Clear ownership",
    proofs: [
      { src: "/work/veridanth-evidence-v2.webp", label: "Studio" },
      {
        src: "/motion/kingxford-decision-theatre-v2.webp",
        label: "Living Room",
      },
      {
        src: "/work/psyche-atlas-evidence-v2.webp",
        label: "Lab",
      },
    ],
  },
  {
    id: "durable-progress",
    label: "Durable Progress",
    index: "05",
    range: [0.86, 1],
    eyebrow: "Durable progress / Useful, inclusive, resource-aware",
    title: "Make progress durable—and widely useful.",
    body:
      "We help teams turn research, digital systems, and productive capacity into services that remain useful over time and within real resource limits.",
    image: capabilityReactorImage,
    imageAlt:
      "Conceptual editorial image of an engineered X connecting water, energy, mobility, research, and productive systems",
    evidence: "Design principle / Complex ideas, clearly delivered.",
    align: "end",
  },
] as const;

type RealityPlateProps = Readonly<{
  chapter: CinematicChapter;
  progress: MotionValue<number>;
  priority?: boolean;
  index: number;
}>;

function RealityPlate({
  chapter,
  progress,
  priority = false,
  index,
}: RealityPlateProps) {
  const [start, end] = chapter.range;
  const feather = Math.min(0.04, Math.max(0.022, (end - start) / 3.5));
  const visibility = visibilityWindow(start, end, feather);
  const opacity = useTransform(
    progress,
    visibility.input,
    visibility.opacity,
  );
  const travelInput =
    start === 0
      ? [0, end, 1]
      : end === 1
        ? [0, start, 1]
        : [0, start, end, 1];
  const scale = useTransform(
    progress,
    travelInput,
    start === 0
      ? [1.12, 1.015, 1.015]
      : end === 1
        ? [1.12, 1.12, 1.015]
        : [1.12, 1.12, 1.015, 1.015],
  );
  const xStart = index % 2 === 0 ? "-2.5%" : "2.5%";
  const xEnd = index % 2 === 0 ? "1.5%" : "-1.5%";
  const x = useTransform(
    progress,
    travelInput,
    start === 0
      ? [xStart, xEnd, xEnd]
      : end === 1
        ? [xStart, xStart, xEnd]
        : [xStart, xStart, xEnd, xEnd],
  );
  const captionY = useTransform(
    progress,
    travelInput,
    start === 0
      ? [18, -10, -10]
      : end === 1
        ? [18, 18, -10]
        : [18, 18, -10, -10],
  );

  return (
    <m.figure
      className="kx-reality-plate"
      data-plate={chapter.id}
      style={{ opacity }}
      aria-hidden={index === 0 ? undefined : "true"}
    >
      <m.div
        className="kx-reality-plate__image"
        style={{ scale, x }}
      >
        <Image
          src={chapter.image}
          alt={index === 0 ? chapter.imageAlt : ""}
          fill
          priority={priority}
          sizes="100vw"
          quality={94}
        />
      </m.div>
      <div className="kx-reality-plate__grade" />
      <m.figcaption style={{ y: captionY }}>
        <span>Reality / {chapter.index}</span>
        <span>{chapter.evidence}</span>
      </m.figcaption>
    </m.figure>
  );
}

type ChapterProps = Readonly<{
  chapter: CinematicChapter;
  progress: MotionValue<number>;
}>;

function Chapter({ chapter, progress }: ChapterProps) {
  const [start, end] = chapter.range;
  const feather = Math.min(0.025, Math.max(0.012, (end - start) / 4));
  const visibility = visibilityWindow(start, end, feather);
  const opacity = useTransform(
    progress,
    visibility.input,
    visibility.opacity,
  );
  const y = useTransform(progress, visibility.input, visibility.y);

  return (
    <m.article
      className="kx-cinematic__chapter"
      data-chapter={chapter.id}
      data-align={chapter.align ?? "start"}
      style={{ opacity, y }}
    >
      <p className="kx-cinematic__eyebrow">{chapter.eyebrow}</p>
      <h2>{chapter.title}</h2>
      <p>{chapter.body}</p>
      {chapter.proofs ? (
        <div
          className="kx-cinematic__proofs"
          aria-label="Editorial project concepts"
        >
          {chapter.proofs.map((proof) => (
            <figure key={`${chapter.id}-${proof.label}`}>
              <Image
                src={proof.src}
                alt=""
                fill
                quality={90}
                sizes="(max-width: 760px) 42vw, 18vw"
              />
              <figcaption>{proof.label}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {chapter.id === "durable-progress" ? (
        <div className="kx-cinematic__chapter-actions">
          <a href="#three-worlds">Ways to work</a>
          <a href="/lab">Explore R&amp;D</a>
          <a href="/contact">Discuss a project</a>
        </div>
      ) : null}
    </m.article>
  );
}

function StaticCinematic() {
  return (
    <section
      className="kx-static"
      id="mission"
      aria-labelledby="kx-static-title"
    >
      <div className="kx-static__hero">
        <KingxfordLogo
          className="kx-static__logo"
          decorative
        />
        <p>kingXford &amp; Co / Research, design, and responsible technology</p>
        <h2 id="kx-static-title">
          Research hard problems.
          <em>Build useful systems.</em>
        </h2>
        <div>
          <p>
            We combine research, product design, development, and responsible
            AI to help people and institutions make better decisions and
            deliver complex work.
          </p>
          <a href="#three-worlds">
            Explore how we deliver
            <ArrowDown aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="kx-static__chapters">
        {chapters.slice(1).map((chapter) => (
          <article className="kx-static__chapter" key={chapter.id}>
            <div className="kx-static__image">
              <Image
                src={chapter.image}
                alt={chapter.imageAlt}
                fill
                sizes="100vw"
                quality={94}
              />
            </div>
            <div>
              <p>{chapter.eyebrow}</p>
              <h2>{chapter.title}</h2>
              <p>{chapter.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function KingxfordCinematic() {
  const sectionRef = useRef<HTMLElement>(null);
  const activeChapterRef = useRef(0);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const reducedMotion = useReducedMotion();
  const [activeChapter, setActiveChapter] = useState(0);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const loomOpacity = useTransform(
    scrollYProgress,
    [0, 0.045, 0.12],
    [1, 0.72, 0],
  );
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    const chapterIndex = chapters.findLastIndex(
      (chapter) => progress >= chapter.range[0],
    );
    const nextChapter = Math.max(0, chapterIndex);
    if (nextChapter !== activeChapterRef.current) {
      activeChapterRef.current = nextChapter;
      setActiveChapter(nextChapter);
    }
  });

  if (isHydrated && reducedMotion) return <StaticCinematic />;

  return (
    <section
      className="kx-cinematic"
      id="mission"
      ref={sectionRef}
      aria-label="kingXford & Co mission: research, design, and responsible technology for complex work"
      data-media-ready="true"
    >
      <div className="kx-cinematic__stage">
        <div className="kx-cinematic__plates">
          {chapters.map((chapter, index) => (
            <RealityPlate
              chapter={chapter}
              progress={scrollYProgress}
              priority={index === 0}
              index={index}
              key={chapter.id}
            />
          ))}
        </div>

        <m.div
          className="kx-cinematic__loom"
          style={{ opacity: loomOpacity }}
          aria-hidden="true"
        >
          <LoomCanvas />
        </m.div>
        <div className="kx-cinematic__veil" aria-hidden="true" />
        <div className="kx-cinematic__grain" aria-hidden="true" />

        <div className="kx-cinematic__masthead">
          <KingxfordLogo
            className="kx-cinematic__logo"
            decorative
          />
          <span>Research / Digital products / Responsible AI</span>
          <span>From complex problem to tested delivery</span>
        </div>

        <div className="kx-cinematic__chapters">
          {chapters.map((chapter) => (
            <Chapter
              chapter={chapter}
              progress={scrollYProgress}
              key={chapter.id}
            />
          ))}
        </div>

        <div className="kx-cinematic__rail" aria-hidden="true">
          <span>{chapters[activeChapter].index}</span>
          <div className="kx-cinematic__rail-track">
            <m.span style={{ scaleX: scrollYProgress }} />
          </div>
          <div className="kx-cinematic__rail-labels">
            {chapters.map((chapter, index) => (
              <span
                data-active={activeChapter === index ? "true" : "false"}
                key={chapter.id}
              >
                {chapter.label}
              </span>
            ))}
          </div>
          <span>{String(chapters.length - 1).padStart(2, "0")}</span>
        </div>

        <Link className="kx-cinematic__work-link" href="/work">
          Selected work
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
