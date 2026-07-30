"use client";

import { m, useReducedMotion } from "motion/react";

type KingxfordMarkProps = Readonly<{
  className?: string;
  decorative?: boolean;
  label?: string;
}>;

export function KingxfordMark({
  className,
  decorative = false,
  label = "Kingxford X mark",
}: KingxfordMarkProps) {
  const shouldReduceMotion = useReducedMotion();
  const rootClass = className
    ? `kingxford-mark ${className}`
    : "kingxford-mark";

  return (
    <svg
      className={rootClass}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
      focusable="false"
    >
      {!decorative && <title>{label}</title>}
      <m.path
        className="kingxford-mark__beam kingxford-mark__beam--back"
        d="M4 9 9 4l35 35-5 5L4 9Z"
        initial={shouldReduceMotion ? false : { scale: 0.15, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <m.g
        className="kingxford-mark__beam kingxford-mark__beam--front"
        initial={shouldReduceMotion ? false : { scale: 0.15, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.55,
          delay: shouldReduceMotion ? 0 : 0.08,
          ease: [0.16, 1, 0.3, 1],
        }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <path d="M39 4 44 9 28.6 24.4l-5-5L39 4Z" />
        <path d="m19.4 23.6 5 5L9 44l-5-5 15.4-15.4Z" />
      </m.g>
    </svg>
  );
}

type KingxfordLogoProps = Readonly<{
  className?: string;
  decorative?: boolean;
}>;

export function KingxfordLogo({
  className,
  decorative = false,
}: KingxfordLogoProps) {
  const rootClass = className
    ? `kingxford-logo ${className}`
    : "kingxford-logo";

  return (
    <span
      className={rootClass}
      aria-label={decorative ? undefined : "Kingxford"}
      role={decorative ? undefined : "img"}
    >
      <span aria-hidden="true">king</span>
      <KingxfordMark
        className="kingxford-logo__x"
        decorative
      />
      <span aria-hidden="true">ford</span>
    </span>
  );
}
