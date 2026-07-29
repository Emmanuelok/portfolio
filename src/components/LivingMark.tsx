"use client";

import { m, useReducedMotion } from "motion/react";
import { useId } from "react";

type LivingMarkProps = Readonly<{
  className?: string;
  decorative?: boolean;
  label?: string;
}>;

export function LivingMark({
  className,
  decorative = false,
  label = "Kingxford Studio woven K",
}: LivingMarkProps) {
  const shouldReduceMotion = useReducedMotion();
  const reactId = useId();
  const gradientId = `living-mark-${reactId.replaceAll(":", "")}`;

  return (
    <svg
      className={className ? `living-mark ${className}` : "living-mark"}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
      focusable="false"
    >
      {!decorative && <title>{label}</title>}
      <defs>
        <linearGradient
          id={gradientId}
          x1="14"
          y1="12"
          x2="84"
          y2="86"
          gradientUnits="userSpaceOnUse"
        >
          <stop className="living-mark__stop living-mark__stop--one" />
          <stop
            offset="0.5"
            className="living-mark__stop living-mark__stop--two"
          />
          <stop
            offset="1"
            className="living-mark__stop living-mark__stop--three"
          />
        </linearGradient>
      </defs>

      <m.path
        className="living-mark__orbit"
        d="M18 49C18 28.6 31.6 14 48 14C64.4 14 78 28.6 78 49C78 69.4 64.4 84 48 84C31.6 84 18 69.4 18 49Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="3 8"
        initial={false}
        animate={
          shouldReduceMotion
            ? { strokeDashoffset: 0 }
            : {
                strokeDashoffset: [0, -44],
                pathLength: [0.82, 1, 0.82],
              }
        }
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : {
                strokeDashoffset: {
                  duration: 8,
                  ease: "linear",
                  repeat: Infinity,
                },
                pathLength: {
                  duration: 5,
                  ease: "easeInOut",
                  repeat: Infinity,
                },
              }
        }
      />

      <path
        className="living-mark__thread living-mark__thread--back"
        d="M24 70C40 70 39 24 57 24C67 24 72 35 72 47"
        stroke={`url(#${gradientId})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        className="living-mark__thread living-mark__thread--front"
        d="M24 26C40 26 42 72 58 72C68 72 74 61 74 49"
        stroke={`url(#${gradientId})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        className="living-mark__cut"
        d="M45.6 46.1C47.1 49.9 48.9 53.3 51.1 56.2"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <circle
        className="living-mark__core"
        cx="48"
        cy="48"
        r="4.5"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}
