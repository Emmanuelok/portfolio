import { ViewTransition } from "react";
import type { ReactNode } from "react";

type WorkCoverTransitionProps = Readonly<{
  slug: string;
  children: ReactNode;
}>;

/**
 * Names a case-study cover for the View Transitions API so the card image
 * and the project-hero image morph as one element during navigation.
 * `default="none"` keeps the pair inert during unrelated transitions; the
 * morph class is styled in globals.css and disabled for reduced motion.
 */
export function WorkCoverTransition({
  slug,
  children,
}: WorkCoverTransitionProps) {
  return (
    <ViewTransition
      name={`work-cover-${slug}`}
      share="morph"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
