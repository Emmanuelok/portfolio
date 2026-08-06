"use client";

import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type RevealProps = Readonly<{
  children: ReactNode;
  className?: string;
  id?: string;
  ariaLabel?: string;
  delay?: number;
  distance?: number;
  amount?: number;
}>;

/**
 * A progressive reveal: the server-rendered content remains visible when
 * JavaScript is unavailable. Motion begins only when the enhanced client
 * reaches the element.
 */
export function Reveal({
  children,
  className,
  id,
  ariaLabel,
  delay = 0,
  distance = 28,
  amount = 0.18,
}: RevealProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <m.div
      className={className}
      id={id}
      aria-label={ariaLabel}
      initial={false}
      whileInView={
        shouldReduceMotion
          ? { opacity: 1, y: 0 }
          : { opacity: [0.01, 1], y: [distance, 0] }
      }
      viewport={{ once: true, amount, margin: "0px 0px -8% 0px" }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.82,
        delay: shouldReduceMotion ? 0 : delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </m.div>
  );
}
