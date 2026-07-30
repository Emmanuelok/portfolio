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
const livingRoomImage = "/motion/kingxford-reality-living-room.webp";
const labImage = "/motion/kingxford-reality-lab.webp";

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
    id: "arrival",
    label: "Kingxford",
    index: "00",
    range: [0, 0.18],
    eyebrow: "Kingxford / Three worlds. One company.",
    title: "Complex ideas. Unforgettable form.",
    body:
      "We turn difficult ideas into worlds people can see, use, understand, and remember.",
    image: arrivalImage,
    imageAlt:
      "Intersecting steel beams in a real contemporary structure",
    evidence: "Real architecture / X as structure",
  },
  {
    id: "studio",
    label: "Studio",
    index: "01",
    range: [0.17, 0.39],
    eyebrow: "Studio / Digital creation",
    title: "Build what people can enter.",
    body:
      "Digital tools, web apps, websites, products, cinematography, motion, identities, and complete visual systems—from first idea to live release.",
    image: studioImage,
    imageAlt:
      "A real film studio with a cinema camera, lighting, and production equipment",
    evidence: "Documentary production environment",
    align: "end",
    proofs: [
      { src: "/work/kisuyo-studio-real.webp", label: "KISUYO / Product" },
      { src: "/work/king-uml-live.webp", label: "Glyph / Tool" },
    ],
  },
  {
    id: "living-room",
    label: "Living Room",
    index: "02",
    range: [0.38, 0.61],
    eyebrow: "The Living Room / Open-ended practice",
    title: "Make room for what has no category.",
    body:
      "Special commissions, strategy, experiences, stories, and uncommon collaborations shaped around what the moment actually needs.",
    image: livingRoomImage,
    imageAlt:
      "A real, warm living room arranged around furniture, art, and open space",
    evidence: "Photographed space / Open possibility",
  },
  {
    id: "lab",
    label: "Lab",
    index: "03",
    range: [0.6, 0.82],
    eyebrow: "Lab / Science & academia",
    title: "Evidence, made visible.",
    body:
      "Research platforms, academic systems, data experiences, knowledge tools, and scientific communication built with depth and clarity.",
    image: labImage,
    imageAlt:
      "A real laboratory researcher working with samples under a sterile hood",
    evidence: "Documentary research environment",
    align: "end",
    proofs: [
      { src: "/work/ccai-global-live.webp", label: "CCAI / Knowledge" },
      {
        src: "/work/megaproject-intelligence-real.webp",
        label: "COMPSIS / Data",
      },
    ],
  },
  {
    id: "one-practice",
    label: "One company",
    index: "04",
    range: [0.81, 0.96],
    eyebrow: "One Kingxford / Different doors",
    title: "The same standard in every room.",
    body:
      "Clear thinking. Distinctive form. Work designed to matter beyond the first impression.",
    image: arrivalImage,
    imageAlt:
      "Intersecting architectural beams representing Kingxford's connected worlds",
    evidence: "Studio / Living Room / Lab",
    proofs: [
      { src: "/work/kisuyo-studio-real.webp", label: "Studio" },
      { src: "/motion/kingxford-reality-living-room-portrait.webp", label: "Living Room" },
      { src: "/work/king-uml-live.webp", label: "Lab" },
    ],
  },
  {
    id: "choose",
    label: "Enter",
    index: "05",
    range: [0.94, 1],
    eyebrow: "Studio / Living Room / Lab",
    title: "Choose your door.",
    body:
      "Or bring us something the world has not named yet.",
    image: arrivalImage,
    imageAlt:
      "The architectural crossing that connects the three Kingxford worlds",
    evidence: "One company / Three ways in",
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
          aria-label="Real project interfaces"
        >
          {chapter.proofs.map((proof) => (
            <figure key={`${chapter.id}-${proof.label}`}>
              <Image
                src={proof.src}
                alt=""
                fill
                sizes="(max-width: 760px) 42vw, 18vw"
              />
              <figcaption>{proof.label}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {chapter.id === "choose" ? (
        <div className="kx-cinematic__chapter-actions">
          <a href="#studio">Studio</a>
          <a href="#living-room">Living Room</a>
          <a href="#lab">Lab</a>
        </div>
      ) : null}
    </m.article>
  );
}

function StaticCinematic() {
  return (
    <section
      className="kx-static"
      id="top"
      aria-labelledby="kx-static-title"
    >
      <div className="kx-static__hero">
        <KingxfordLogo
          className="kx-static__logo"
          decorative
        />
        <p>Kingxford / Three worlds. One company.</p>
        <h1 id="kx-static-title">
          Complex ideas.
          <em>Unforgettable form.</em>
        </h1>
        <div>
          <p>
            A multidisciplinary creative company for digital creation,
            open-ended collaboration, and scientific and academic work.
          </p>
          <a href="#three-worlds">
            Explore the three worlds
            <ArrowDown aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="kx-static__chapters">
        {chapters.slice(1, 4).map((chapter) => (
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
      id="top"
      ref={sectionRef}
      aria-label="Kingxford: three worlds, one company"
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
          <span>Three worlds / One company</span>
          <span>Real environments / Live product evidence</span>
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
