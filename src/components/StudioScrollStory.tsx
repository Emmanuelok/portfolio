"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import {
  m,
  type MotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

type StoryChapter = Readonly<{
  id: string;
  range: readonly [number, number];
  eyebrow: string;
  title: string;
  body: string;
  align?: "start" | "end";
}>;

const motionMaster =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3ChJ2tLVG7i2Ag6ynWBf8Xmyz6a/hf_20260729_223246_cf312474-d661-476c-8dd6-80d3ee9304c0.mp4";

const chapters: readonly StoryChapter[] = [
  {
    id: "threshold",
    range: [0.02, 0.28],
    eyebrow: "00 / The threshold",
    title: "Welcome to The Living Room.",
    body:
      "The front room of Kingxford Studio—an evolving place where ideas arrive unfinished and leave with a pulse.",
  },
  {
    id: "signal",
    range: [0.25, 0.52],
    eyebrow: "01 / The signal",
    title: "One thread. Many disciplines.",
    body:
      "Graphic identities, intelligent products, websites, research, and motion are connected by one question: what should this make possible?",
    align: "end",
  },
  {
    id: "point-of-view",
    range: [0.49, 0.77],
    eyebrow: "02 / The point of view",
    title: "Design is how ambiguity earns a shape.",
    body:
      "Strategy gives the work direction. Visual systems give it memory. Technology gives it a life beyond the screen.",
  },
  {
    id: "gallery",
    range: [0.74, 0.99],
    eyebrow: "03 / The gallery",
    title: "Step into the work.",
    body:
      "Every project ahead is a room of its own—built to be entered, understood, and remembered.",
    align: "end",
  },
] as const;

type ChapterLayerProps = Readonly<{
  chapter: StoryChapter;
  progress: MotionValue<number>;
  reducedMotion: boolean;
}>;

function ChapterLayer({
  chapter,
  progress,
  reducedMotion,
}: ChapterLayerProps) {
  const [start, end] = chapter.range;
  const feather = Math.min(0.075, (end - start) / 3);
  const opacity = useTransform(
    progress,
    [start, start + feather, end - feather, end],
    [0, 1, 1, 0],
  );
  const y = useTransform(
    progress,
    [start, start + feather, end - feather, end],
    [44, 0, 0, -30],
  );

  return (
    <m.article
      className="studio-story__chapter"
      data-align={chapter.align ?? "start"}
      style={reducedMotion ? undefined : { opacity, y }}
    >
      <p className="studio-story__eyebrow">{chapter.eyebrow}</p>
      <h3>{chapter.title}</h3>
      <p>{chapter.body}</p>
    </m.article>
  );
}

export function StudioScrollStory() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(10);
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const frozenRef = useRef(false);
  const mediaReadyRef = useRef(false);
  const [sourcesAttached, setSourcesAttached] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<
    "poster" | "loading" | "ready" | "error"
  >("poster");
  const [isFrozen, setIsFrozen] = useState(false);
  const [motionPreference, setMotionPreference] = useState<
    "pending" | "reduce" | "no-preference"
  >("pending");
  const libraryReducedMotion = useReducedMotion();
  const motionPreferenceReady = motionPreference !== "pending";
  const shouldReduceMotion =
    libraryReducedMotion === true || motionPreference === "reduce";
  const shouldLoadVideo = sourcesAttached && !shouldReduceMotion;
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      if (mediaQuery.matches) {
        mediaReadyRef.current = false;
        setMediaStatus("poster");
      }
      setMotionPreference(mediaQuery.matches ? "reduce" : "no-preference");
    };

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  const seekToProgress = (progress: number) => {
    const video = videoRef.current;
    if (
      !video ||
      !mediaReadyRef.current ||
      frozenRef.current ||
      video.seeking ||
      !Number.isFinite(durationRef.current)
    ) {
      return;
    }

    const target = Math.max(
      0,
      Math.min(durationRef.current - 1 / 24, progress * durationRef.current),
    );

    if (Math.abs(video.currentTime - target) < 1 / 24) return;
    try {
      video.currentTime = target;
    } catch {
      mediaReadyRef.current = false;
      setMediaStatus("error");
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

  useMotionValueEvent(scrollYProgress, "change", scheduleSeek);

  useEffect(() => {
    frozenRef.current = isFrozen;
    if (!isFrozen) scheduleSeek(progressRef.current);
    // scheduleSeek intentionally reads the current refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFrozen]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !motionPreferenceReady || shouldReduceMotion) return;

    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean };
      }
    ).connection;

    if (connection?.saveData) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio <= 0) return;
        setSourcesAttached(true);
        setMediaStatus("loading");
        observer.disconnect();
      },
      { rootMargin: "0px", threshold: 0.01 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [motionPreferenceReady, shouldReduceMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoadVideo) return;

    const handleMetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        durationRef.current = video.duration;
      }
      video.pause();
      scheduleSeek(progressRef.current);
    };
    const handleReady = () => {
      mediaReadyRef.current = true;
      setMediaStatus("ready");
      video.pause();
      scheduleSeek(progressRef.current);
    };
    const handleError = () => {
      mediaReadyRef.current = false;
      setMediaStatus("error");
    };
    const handleSeeked = () => scheduleSeek(progressRef.current);
    const handleVisibility = () => {
      if (document.hidden) {
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        video.pause();
        return;
      }
      scheduleSeek(progressRef.current);
    };
    const readinessTimeout = window.setTimeout(() => {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        mediaReadyRef.current = false;
        setMediaStatus("error");
      }
    }, 8_000);

    video.addEventListener("loadedmetadata", handleMetadata);
    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("error", handleError);
    video.addEventListener("seeked", handleSeeked);
    document.addEventListener("visibilitychange", handleVisibility);
    video.load();

    return () => {
      window.clearTimeout(readinessTimeout);
      video.removeEventListener("loadedmetadata", handleMetadata);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
      video.removeEventListener("seeked", handleSeeked);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      video.pause();
      mediaReadyRef.current = false;
    };
    // scheduleSeek intentionally reads the current refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldLoadVideo]);

  useEffect(() => {
    if (!shouldReduceMotion) return;

    const video = videoRef.current;
    mediaReadyRef.current = false;
    if (video) {
      video.pause();
      video.load();
    }
  }, [shouldReduceMotion]);

  return (
    <section
      className="studio-story"
      id="living-room"
      ref={sectionRef}
      aria-labelledby="studio-story-title"
      data-media-status={mediaStatus}
      data-reduced-motion={shouldReduceMotion ? "true" : "false"}
    >
      <div className="studio-story__stage">
        <div className="studio-story__poster-frame" aria-hidden="true">
          <Image
            className="studio-story__poster"
            src="/motion/kingxford-living-room-poster.webp"
            alt=""
            fill
            sizes="100vw"
          />
        </div>

        <video
          className="studio-story__video"
          ref={videoRef}
          muted
          playsInline
          preload={shouldLoadVideo ? "auto" : "none"}
          aria-hidden="true"
          tabIndex={-1}
          disablePictureInPicture
          disableRemotePlayback
        >
          {shouldLoadVideo && (
            <source src={motionMaster} type="video/mp4" />
          )}
        </video>

        <div className="studio-story__veil" aria-hidden="true" />
        <div className="studio-story__grain" aria-hidden="true" />

        <div className="studio-story__masthead">
          <div>
            <span>KX / 00</span>
            <span>Kingxford Studio</span>
          </div>
          <p>The Living Room</p>
        </div>

        <div className="studio-story__chapters">
          <h2 className="sr-only" id="studio-story-title">
            Enter The Living Room at Kingxford Studio
          </h2>
          {chapters.map((chapter) => (
            <ChapterLayer
              chapter={chapter}
              progress={scrollYProgress}
              reducedMotion={shouldReduceMotion}
              key={chapter.id}
            />
          ))}
        </div>

        <div className="studio-story__timeline" aria-hidden="true">
          <span>00</span>
          <div>
            <m.span style={{ scaleX: scrollYProgress }} />
          </div>
          <span>03</span>
        </div>

        {mediaStatus === "loading" && (
          <p className="studio-story__status" role="status">
            Preparing motion
          </p>
        )}

        {mediaStatus === "ready" && !shouldReduceMotion && (
          <button
            className="studio-story__control"
            type="button"
            aria-pressed={isFrozen}
            aria-label={isFrozen ? "Resume motion" : "Freeze motion"}
            onClick={() => setIsFrozen((current) => !current)}
          >
            {isFrozen ? (
              <Play aria-hidden="true" />
            ) : (
              <Pause aria-hidden="true" />
            )}
            <span>{isFrozen ? "Resume" : "Freeze"}</span>
          </button>
        )}
      </div>
    </section>
  );
}
