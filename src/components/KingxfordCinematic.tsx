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
import { useEffect, useRef, useState } from "react";

import { LoomCanvas } from "@/components/LoomCanvas";

type CinematicChapter = Readonly<{
  id: string;
  label: string;
  index: string;
  range: readonly [number, number];
  eyebrow: string;
  title: string;
  body: string;
  align?: "start" | "end";
  poster: string;
}>;

const motionMaster =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_3ChJ2tLVG7i2Ag6ynWBf8Xmyz6a/fd4b72d2-7a67-480a-9dd2-3a2a15170c59.mp4";
const motionMasterMobile =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_3ChJ2tLVG7i2Ag6ynWBf8Xmyz6a/ef3a6efe-1145-4a99-800e-be527a13a45e.mp4";
const arrivalPoster = "/motion/kingxford-house-arrival.webp";
const studioPoster = "/motion/kingxford-house-studio.webp";
const livingRoomPoster = "/motion/kingxford-house-living-room.webp";
const labPoster = "/motion/kingxford-house-lab.webp";

const chapters: readonly CinematicChapter[] = [
  {
    id: "arrival",
    label: "Kingxford",
    index: "00",
    range: [0, 0.18],
    eyebrow: "Kingxford / Three worlds. One practice.",
    title: "Complex ideas. Unforgettable form.",
    body:
      "We turn difficult ideas into worlds people can see, use, understand, and remember.",
    poster: arrivalPoster,
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
    poster: studioPoster,
    align: "end",
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
    poster: livingRoomPoster,
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
    poster: labPoster,
    align: "end",
  },
  {
    id: "one-practice",
    label: "One practice",
    index: "04",
    range: [0.81, 0.96],
    eyebrow: "One Kingxford / Different doors",
    title: "The same standard in every room.",
    body:
      "Clear thinking. Distinctive form. Work designed to matter beyond the first impression.",
    poster: labPoster,
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
    poster: labPoster,
    align: "end",
  },
] as const;

type ChapterProps = Readonly<{
  chapter: CinematicChapter;
  progress: MotionValue<number>;
}>;

function Chapter({ chapter, progress }: ChapterProps) {
  const [start, end] = chapter.range;
  const feather = Math.min(0.025, Math.max(0.012, (end - start) / 4));
  const isFirst = start === 0;
  const isFinal = end === 1;
  const opacity = useTransform(
    progress,
    isFirst
      ? [start, end - feather, end]
      : isFinal
      ? [start, start + feather, end]
      : [start, start + feather, end - feather, end],
    isFirst ? [1, 1, 0] : isFinal ? [0, 1, 1] : [0, 1, 1, 0],
  );
  const y = useTransform(
    progress,
    isFirst
      ? [start, end - feather, end]
      : isFinal
      ? [start, start + feather, end]
      : [start, start + feather, end - feather, end],
    isFirst ? [0, 0, -24] : isFinal ? [34, 0, 0] : [34, 0, 0, -24],
  );

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
      {chapter.id === "choose" && (
        <div className="kx-cinematic__chapter-actions">
          <a href="#studio">Studio</a>
          <a href="#living-room">Living Room</a>
          <a href="#lab">Lab</a>
        </div>
      )}
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
        <p>Kingxford / Three worlds. One practice.</p>
        <h1 id="kx-static-title">
          Complex ideas.
          <em>Unforgettable form.</em>
        </h1>
        <div>
          <p>
            A multidisciplinary practice for digital creation, open-ended
            collaboration, and scientific and academic work.
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
                src={chapter.poster}
                alt=""
                fill
                sizes="100vw"
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(24);
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const canSeekRef = useRef(false);
  const activeChapterRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const [activeChapter, setActiveChapter] = useState(0);
  const [sourceAttached, setSourceAttached] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [staticMode, setStaticMode] = useState(false);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const loomOpacity = useTransform(
    scrollYProgress,
    [0, 0.045, 0.12],
    [1, 0.72, 0],
  );
  const architectureScale = useTransform(
    scrollYProgress,
    [0, 0.12, 1],
    [1.055, 1.015, 1],
  );
  const xScale = useTransform(
    scrollYProgress,
    [0, 0.12, 0.88, 1],
    [0.05, 1, 1, 0.2],
  );

  useEffect(() => {
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    const slowConnection =
      connection?.saveData === true ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g";
    const frame = window.requestAnimationFrame(() => {
      setStaticMode(reducedMotion === true || slowConnection);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [reducedMotion]);

  const markFrameReady = () => {
    const video = videoRef.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (
            callback: () => void,
          ) => number;
        })
      | null;
    if (!video) return;

    if (video.requestVideoFrameCallback) {
      video.requestVideoFrameCallback(() => setMediaReady(true));
    } else {
      window.requestAnimationFrame(() => setMediaReady(true));
    }
  };

  const seekToProgress = (progress: number) => {
    const video = videoRef.current;
    if (
      !video ||
      !canSeekRef.current ||
      video.seeking ||
      !Number.isFinite(durationRef.current)
    ) {
      return;
    }

    const target = Math.max(
      0,
      Math.min(
        durationRef.current - 1 / 24,
        progress * durationRef.current,
      ),
    );
    if (Math.abs(video.currentTime - target) < 1 / 24) {
      markFrameReady();
      return;
    }

    try {
      video.currentTime = target;
    } catch {
      setStaticMode(true);
    }
  };

  const scheduleSeek = (progress: number) => {
    progressRef.current = progress;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      seekToProgress(progressRef.current);
    });
  };

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    scheduleSeek(progress);
    const chapterIndex = chapters.findLastIndex(
      (chapter) => progress >= chapter.range[0],
    );
    const nextChapter = Math.max(0, chapterIndex);
    if (nextChapter !== activeChapterRef.current) {
      activeChapterRef.current = nextChapter;
      setActiveChapter(nextChapter);
    }
  });

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || staticMode) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setSourceAttached(true);
        observer.disconnect();
      },
      { rootMargin: "150% 0px", threshold: 0.001 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [staticMode]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !sourceAttached || staticMode) return;

    const handleMetadata = () => {
      durationRef.current =
        Number.isFinite(video.duration) && video.duration >= 18
          ? video.duration
          : 24;
      canSeekRef.current = true;
      video.pause();
      scheduleSeek(progressRef.current);
    };
    const handleLoaded = () => {
      canSeekRef.current = true;
      video.pause();
      scheduleSeek(progressRef.current);
      markFrameReady();
    };
    const handleSeeked = () => {
      markFrameReady();
      scheduleSeek(progressRef.current);
    };
    const handleError = () => {
      canSeekRef.current = false;
      setStaticMode(true);
    };
    const handleVisibility = () => {
      video.pause();
      if (!document.hidden) scheduleSeek(progressRef.current);
    };

    video.addEventListener("loadedmetadata", handleMetadata);
    video.addEventListener("loadeddata", handleLoaded);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);
    document.addEventListener("visibilitychange", handleVisibility);
    video.load();

    return () => {
      video.removeEventListener("loadedmetadata", handleMetadata);
      video.removeEventListener("loadeddata", handleLoaded);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
      document.removeEventListener("visibilitychange", handleVisibility);
      video.pause();
      canSeekRef.current = false;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
    // scheduleSeek and markFrameReady intentionally read stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceAttached, staticMode]);

  if (staticMode) return <StaticCinematic />;

  return (
    <section
      className="kx-cinematic"
      id="top"
      ref={sectionRef}
      aria-label="Kingxford: three worlds, one practice"
      data-media-ready={mediaReady ? "true" : "false"}
    >
      <div className="kx-cinematic__stage">
        <m.div
          className="kx-cinematic__media"
          style={{ scale: architectureScale }}
          aria-hidden="true"
        >
          <div className="kx-cinematic__poster">
            <Image
              src={arrivalPoster}
              alt=""
              fill
              priority
              sizes="100vw"
            />
          </div>
          <video
            className="kx-cinematic__video"
            ref={videoRef}
            muted
            playsInline
            preload={sourceAttached ? "auto" : "none"}
            tabIndex={-1}
            disablePictureInPicture
            disableRemotePlayback
          >
            {sourceAttached && (
              <>
                <source
                  media="(max-width: 760px)"
                  src={motionMasterMobile}
                  type="video/mp4"
                />
                <source src={motionMaster} type="video/mp4" />
              </>
            )}
          </video>
        </m.div>

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
          style={{ scaleX: xScale }}
          aria-hidden="true"
        >
          <span />
          <span />
        </m.div>

        <div className="kx-cinematic__masthead">
          <span>Kingxford</span>
          <span>Three worlds / One practice</span>
          <span>24-second scroll film</span>
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
