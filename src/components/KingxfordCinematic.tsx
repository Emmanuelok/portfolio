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

const arrivalImage = "/motion/kingxford-reality-arrival.webp";
const studioImage = "/motion/kingxford-reality-studio.webp";
const livingRoomImage = "/motion/kingxford-strategy-room.webp";
const labImage = "/motion/kingxford-scientific-lab.webp";

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
    eyebrow: "kingXford & Co / Intelligence for shared progress",
    title: "Prepare for sustainable abundance.",
    body:
      "We research, develop, and apply responsible AI to help people and institutions solve complex problems and build ambitious ideas, projects, and systems for an abundant future.",
    image: arrivalImage,
    imageAlt:
      "Intersecting steel beams in a real contemporary structure",
    evidence: "Mission / Sustainable abundance",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    index: "01",
    range: [0.17, 0.36],
    eyebrow: "Intelligence / From signals to decisions",
    title: "See the system before choosing the move.",
    body:
      "We connect evidence, foresight, domain knowledge, and human judgement so complexity becomes a field of informed choices—not a reason to stand still.",
    image: livingRoomImage,
    imageAlt:
      "A professional strategy room where a multidisciplinary team studies complex systems around a central table",
    evidence: "Strategy / Systems intelligence",
    align: "end",
    proofs: [
      { src: "/work/veridanth-concept.webp", label: "Veridanth / Practice" },
      { src: "/work/grandmaster-concept.webp", label: "GrandMaster / Learning" },
    ],
  },
  {
    id: "research-development",
    label: "R&D",
    index: "02",
    range: [0.35, 0.54],
    eyebrow: "Research & development / Inquiry into capability",
    title: "Turn uncertainty into testable knowledge.",
    body:
      "We investigate difficult questions, build prototypes, evaluate evidence, and translate useful findings into tools, policies, platforms, and ventures that can endure.",
    image: labImage,
    imageAlt:
      "Scientists collaborating with microscopy, materials testing, and analytical instruments in an advanced laboratory",
    evidence: "Scientific inquiry / Applied R&D",
  },
  {
    id: "responsible-ai",
    label: "Responsible AI",
    index: "03",
    range: [0.53, 0.72],
    eyebrow: "Responsible AI / Capability with accountability",
    title: "Build intelligence people can question and govern.",
    body:
      "We pursue AI that expands human agency, makes uncertainty visible, protects meaningful oversight, and is evaluated against the people and institutions it affects.",
    image: studioImage,
    imageAlt:
      "A professional production studio representing the disciplined development of intelligent digital systems",
    evidence: "Human agency / Responsible deployment",
    align: "end",
    proofs: [
      { src: "/work/ccai-global-concept.webp", label: "CCAI / Knowledge" },
      {
        src: "/work/psyche-atlas-concept.webp",
        label: "Psyche Atlas / Reflection",
      },
    ],
  },
  {
    id: "and-co",
    label: "& Co",
    index: "04",
    range: [0.71, 0.87],
    eyebrow: "& Co / Progress is a collective undertaking",
    title: "The future is built with others.",
    body:
      "We create the conditions for aligned contributors to combine insight, commitment, and capability around consequential work.",
    image: livingRoomImage,
    imageAlt:
      "A multidisciplinary team coordinating complex work in a professional strategy room",
    evidence: "Collaboration / Shared capability",
    proofs: [
      { src: "/work/veridanth-concept.webp", label: "Studio" },
      {
        src: "/motion/kingxford-strategy-room-portrait.webp",
        label: "Living Room",
      },
      { src: "/work/psyche-atlas-concept.webp", label: "Lab" },
    ],
  },
  {
    id: "abundant-future",
    label: "Abundant Future",
    index: "05",
    range: [0.86, 1],
    eyebrow: "Abundant future / Prepared, inclusive, sustainable",
    title: "Make progress durable—and widely useful.",
    body:
      "We prepare people and institutions to turn expanding intelligence, knowledge, and productive capacity into long-term human and ecological value.",
    image: arrivalImage,
    imageAlt:
      "Intersecting architectural beams representing coordinated paths toward an abundant future",
    evidence: "Craft signature / Complex ideas. Unforgettable form.",
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
      {chapter.id === "abundant-future" ? (
        <div className="kx-cinematic__chapter-actions">
          <a href="#three-worlds">Delivery worlds</a>
          <a href="/lab">Explore R&amp;D</a>
          <a href="/contact">Build with us</a>
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
        <p>kingXford &amp; Co / Intelligence for shared progress</p>
        <h1 id="kx-static-title">
          Prepare for
          <em>sustainable abundance.</em>
        </h1>
        <div>
          <p>
            We research, develop, and apply responsible AI to help people and
            institutions solve complex problems and build ambitious ideas,
            projects, and systems for an abundant future.
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
  const xScale = useTransform(
    scrollYProgress,
    [0, 0.1, 0.88, 1],
    [0.04, 1, 1, 0.2],
  );
  const xRotate = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [-5, 0, 5],
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
      aria-label="kingXford & Co mission: intelligence and research for sustainable abundance"
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
        <m.div
          className="kx-cinematic__x"
          style={{ scale: xScale, rotate: xRotate }}
          aria-hidden="true"
        >
          <span />
          <span />
        </m.div>

        <div className="kx-cinematic__masthead">
          <KingxfordLogo
            className="kx-cinematic__logo"
            decorative
          />
          <span>Intelligence / R&amp;D / Responsible AI</span>
          <span>Preparing for sustainable abundance</span>
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
