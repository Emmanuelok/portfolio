"use client";

import { useEffect, useRef } from "react";

type PointerState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  engaged: boolean;
};

const DPR_CAP = 1.75;
const THREAD_COUNT = 13;
const MOTES = Array.from({ length: 24 }, (_, index) => ({
  x: ((index * 47) % 101) / 100,
  y: ((index * 71 + 13) % 97) / 96,
  radius: 0.6 + ((index * 11) % 7) * 0.16,
  speed: 0.3 + ((index * 17) % 9) * 0.08,
}));

function cssColor(
  styles: CSSStyleDeclaration,
  property: string,
  fallback: string,
) {
  return styles.getPropertyValue(property).trim() || fallback;
}

/**
 * Decorative, adaptive canvas for the Living Loom hero.
 *
 * The animation only runs for fine pointers, pauses when hidden/offscreen, caps
 * DPR to protect battery life, and renders one still frame for reduced motion.
 */
export function LoomCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!context) return;

    const finePointerQuery = window.matchMedia("(pointer: fine)");
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    let cssWidth = 1;
    let cssHeight = 1;
    let animationFrame = 0;
    let isOffscreen = false;
    let isDocumentHidden = document.hidden;
    let isDisposed = false;
    let startTime = performance.now();
    let threadA = "#8c7bff";
    let threadB = "#ec6da8";
    let threadC = "#57d9cb";
    let moteColor = "rgba(255,255,255,.75)";

    const pointer: PointerState = {
      x: 0.66,
      y: 0.42,
      targetX: 0.66,
      targetY: 0.42,
      engaged: false,
    };

    const shouldAnimate = () =>
      !isDisposed &&
      !isOffscreen &&
      !isDocumentHidden &&
      finePointerQuery.matches &&
      !reducedMotionQuery.matches;

    const readPalette = () => {
      const styles = getComputedStyle(canvas);
      threadA = cssColor(styles, "--loom-thread-a", "#8c7bff");
      threadB = cssColor(styles, "--loom-thread-b", "#ec6da8");
      threadC = cssColor(styles, "--loom-thread-c", "#57d9cb");
      moteColor = cssColor(
        styles,
        "--loom-mote",
        "rgba(255, 255, 255, .72)",
      );
    };

    const draw = (timestamp: number, still = false) => {
      const time = still ? 2.4 : (timestamp - startTime) / 1000;
      const width = cssWidth;
      const height = cssHeight;

      pointer.x += (pointer.targetX - pointer.x) * 0.035;
      pointer.y += (pointer.targetY - pointer.y) * 0.035;

      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "screen";

      const glow = context.createRadialGradient(
        pointer.x * width,
        pointer.y * height,
        0,
        pointer.x * width,
        pointer.y * height,
        Math.max(width, height) * 0.46,
      );
      glow.addColorStop(0, "rgba(139, 123, 255, .11)");
      glow.addColorStop(0.48, "rgba(87, 217, 203, .035)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      for (let index = 0; index < THREAD_COUNT; index += 1) {
        const progress = index / Math.max(THREAD_COUNT - 1, 1);
        const phase = time * (0.24 + progress * 0.15) + index * 0.61;
        const baseY = height * (0.12 + progress * 0.74);
        const amplitude = height * (0.045 + (index % 4) * 0.012);
        const cursorPull =
          pointer.engaged &&
          Math.abs(baseY / height - pointer.y) < 0.28
            ? (pointer.y * height - baseY) *
              (0.25 - Math.abs(baseY / height - pointer.y) * 0.5)
            : 0;

        const gradient = context.createLinearGradient(
          -width * 0.08,
          0,
          width * 1.08,
          0,
        );
        const palette = index % 3;
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(
          0.2,
          palette === 0 ? threadA : palette === 1 ? threadB : threadC,
        );
        gradient.addColorStop(
          0.56,
          palette === 0 ? threadC : palette === 1 ? threadA : threadB,
        );
        gradient.addColorStop(1, "rgba(0,0,0,0)");

        context.beginPath();
        context.moveTo(-width * 0.08, baseY + Math.sin(phase) * amplitude);
        context.bezierCurveTo(
          width * 0.22,
          baseY - Math.cos(phase * 0.72) * amplitude * 1.8,
          width * (0.45 + (pointer.x - 0.5) * 0.08),
          baseY + Math.sin(phase * 1.11) * amplitude + cursorPull,
          width * 0.57,
          baseY + Math.cos(phase * 0.86) * amplitude + cursorPull * 0.7,
        );
        context.bezierCurveTo(
          width * 0.75,
          baseY - Math.sin(phase * 0.68) * amplitude * 1.6,
          width * 0.92,
          baseY + Math.cos(phase * 1.28) * amplitude,
          width * 1.08,
          baseY - Math.sin(phase * 0.9) * amplitude,
        );
        context.strokeStyle = gradient;
        context.lineWidth = 0.7 + (index % 5) * 0.28;
        context.globalAlpha = 0.22 + (index % 4) * 0.08;
        context.stroke();
      }

      // Cross-threads make the field read as a weave instead of a wave.
      for (let index = 0; index < 6; index += 1) {
        const progress = (index + 1) / 7;
        const x = width * progress;
        const sway = Math.sin(time * 0.31 + index * 1.7) * width * 0.025;
        const gradient = context.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(0.4, index % 2 === 0 ? threadC : threadA);
        gradient.addColorStop(0.7, index % 2 === 0 ? threadA : threadB);
        gradient.addColorStop(1, "rgba(0,0,0,0)");

        context.beginPath();
        context.moveTo(x + sway, -height * 0.08);
        context.bezierCurveTo(
          x - width * 0.08,
          height * 0.28,
          x + width * 0.08,
          height * 0.63,
          x - sway,
          height * 1.08,
        );
        context.strokeStyle = gradient;
        context.lineWidth = 0.55 + (index % 3) * 0.22;
        context.globalAlpha = 0.13;
        context.stroke();
      }

      context.globalCompositeOperation = "source-over";
      context.fillStyle = moteColor;
      for (let index = 0; index < MOTES.length; index += 1) {
        const mote = MOTES[index];
        const drift = still ? 0 : time * mote.speed;
        const x =
          ((mote.x * width + drift * 13 + index * 3) % (width + 30)) - 15;
        const y =
          mote.y * height +
          Math.sin(drift + index * 0.9) * Math.min(20, height * 0.025);
        context.globalAlpha =
          0.14 + (Math.sin(time * 0.8 + index) + 1) * 0.08;
        context.beginPath();
        context.arc(x, y, mote.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
    };

    const loop = (timestamp: number) => {
      animationFrame = 0;
      if (!shouldAnimate()) return;
      draw(timestamp);
      animationFrame = requestAnimationFrame(loop);
    };

    const syncAnimation = () => {
      if (shouldAnimate()) {
        if (!animationFrame) {
          startTime = performance.now() - 2400;
          animationFrame = requestAnimationFrame(loop);
        }
      } else {
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = 0;
        }
        draw(performance.now(), true);
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      cssWidth = Math.max(1, bounds.width);
      cssHeight = Math.max(1, bounds.height);
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      const pixelWidth = Math.max(1, Math.round(cssWidth * dpr));
      const pixelHeight = Math.max(1, Math.round(cssHeight * dpr));

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      readPalette();
      draw(performance.now(), true);
      syncAnimation();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      if (
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      ) {
        pointer.engaged = false;
        return;
      }

      pointer.engaged = true;
      pointer.targetX = (event.clientX - bounds.left) / bounds.width;
      pointer.targetY = (event.clientY - bounds.top) / bounds.height;
    };

    const handleVisibility = () => {
      isDocumentHidden = document.hidden;
      syncAnimation();
    };

    const handleMotionPreference = () => syncAnimation();
    const handlePointerPreference = () => {
      if (finePointerQuery.matches) {
        window.addEventListener("pointermove", handlePointerMove, {
          passive: true,
        });
      } else {
        window.removeEventListener("pointermove", handlePointerMove);
        pointer.engaged = false;
      }
      syncAnimation();
    };

    const resizeObserver = new ResizeObserver(resize);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isOffscreen = !entry.isIntersecting;
        syncAnimation();
      },
      { rootMargin: "120px" },
    );
    const themeObserver = new MutationObserver(() => {
      readPalette();
      if (!shouldAnimate()) draw(performance.now(), true);
    });

    resizeObserver.observe(canvas);
    intersectionObserver.observe(canvas);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotionQuery.addEventListener("change", handleMotionPreference);
    finePointerQuery.addEventListener("change", handlePointerPreference);
    handlePointerPreference();
    resize();

    return () => {
      isDisposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pointermove", handlePointerMove);
      reducedMotionQuery.removeEventListener("change", handleMotionPreference);
      finePointerQuery.removeEventListener(
        "change",
        handlePointerPreference,
      );
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="loom-canvas"
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
