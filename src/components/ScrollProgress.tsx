"use client";

import {
  m,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";

export function ScrollProgress() {
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const easedProgress = useSpring(scrollYProgress, {
    stiffness: 160,
    damping: 32,
    mass: 0.28,
  });
  const progress = shouldReduceMotion ? scrollYProgress : easedProgress;

  return (
    <div className="scroll-progress" aria-hidden="true">
      <m.span
        className="scroll-progress__bar"
        style={{ scaleX: progress }}
      />
    </div>
  );
}

