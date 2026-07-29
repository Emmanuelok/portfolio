"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { m, useReducedMotion } from "motion/react";

import { LivingMark } from "@/components/LivingMark";
import { LoomCanvas } from "@/components/LoomCanvas";

const heroTransition = {
  duration: 0.9,
  ease: [0.22, 1, 0.36, 1] as const,
};

export function Hero() {
  const shouldReduceMotion = useReducedMotion();
  const reveal = (distance: number, delay: number) => ({
    initial: false as const,
    animate: shouldReduceMotion
      ? { opacity: 1, y: 0 }
      : { opacity: [0.01, 1], y: [distance, 0] },
    transition: {
      ...heroTransition,
      duration: shouldReduceMotion ? 0 : heroTransition.duration,
      delay: shouldReduceMotion ? 0 : delay,
    },
  });

  return (
    <section className="hero" id="top" aria-labelledby="hero-heading">
      <LoomCanvas />
      <div className="hero__ambient" aria-hidden="true" />

      <div className="hero__inner">
        <m.div className="hero__kicker" {...reveal(16, 0.05)}>
          <LivingMark className="hero__mark" decorative />
          <span className="hero__eyebrow">
            Kingxford Studio · The Living Room
          </span>
        </m.div>

        <h1 className="hero__title" id="hero-heading">
          <span className="hero__title-line">
            <m.span className="hero__title-text" {...reveal(48, 0.12)}>
              Complex ideas.
            </m.span>
          </span>
          <span className="hero__title-line hero__title-line--accent">
            <m.span className="hero__title-text" {...reveal(52, 0.2)}>
              Unforgettable form.
            </m.span>
          </span>
        </h1>

        <div className="hero__footer">
          <m.p className="hero__lede" {...reveal(24, 0.3)}>
            An evolving, motion-led portfolio by Emmanuel Kingsford Owusu,
            where graphic design, intelligent products, websites, research,
            and visual systems take unforgettable form.
          </m.p>

          <m.div className="hero__actions" {...reveal(22, 0.38)}>
            <Link className="button button--primary" href="/work">
              <span>Explore selected work</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
            <Link className="button button--quiet" href="/about">
              <span>Meet Emmanuel</span>
              <ArrowDownRight aria-hidden="true" />
            </Link>
          </m.div>
        </div>

        <m.div className="hero__signal" {...reveal(12, 0.48)}>
          <span className="hero__signal-dot" aria-hidden="true" />
          <span>Available for select collaborations</span>
          <span className="hero__signal-rule" aria-hidden="true" />
          <a href="#living-room">Scroll to enter The Living Room</a>
        </m.div>
      </div>
    </section>
  );
}
