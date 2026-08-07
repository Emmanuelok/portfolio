import type { Metadata } from "next";
import Link from "next/link";

import {
  TrustCallout,
  TrustPage,
  TrustSection,
} from "@/app/privacy/TrustPage";

export const metadata: Metadata = {
  title: "Accessibility Statement",
  description:
    "The accessibility target, implemented measures, known limits, and feedback path for kingxford.co.",
  alternates: { canonical: "/accessibility" },
};

const contents = [
  { id: "commitment", label: "Commitment and target" },
  { id: "measures", label: "Measures in the platform" },
  { id: "workspace-access", label: "Workspace and generated content" },
  { id: "limits", label: "Known limits" },
  { id: "feedback", label: "Feedback and alternatives" },
  { id: "assessment", label: "Assessment and review" },
] as const;

export default function AccessibilityPage() {
  return (
    <TrustPage
      eyebrow="Accessibility · Inclusive interaction · Continuous review"
      title="Access is part of the work."
      introduction="kingXford & Co treats accessibility as a product requirement throughout research, design, development, and review—not as a final visual adjustment."
      contents={contents}
    >
      <TrustSection id="commitment" title="Commitment and target">
        <p>
          The platform is designed toward the Web Content Accessibility
          Guidelines (WCAG) 2.2 Level AA as an ongoing target. This is a design
          and testing objective, not a claim of independent certification or
          complete conformance across every device, browser, prototype, and
          user-generated artifact.
        </p>
        <p>
          Accessibility decisions consider people who navigate by keyboard,
          use screen readers or magnification, reduce motion, adjust contrast or
          type size, use touch or voice input, or need direct and predictable
          language.
        </p>
      </TrustSection>

      <TrustSection id="measures" title="Measures already built into the platform">
        <ul>
          <li>semantic landmarks, ordered headings, and labelled navigation;</li>
          <li>a skip link and visible keyboard focus treatment;</li>
          <li>responsive layouts that reflow for narrow screens and zoom;</li>
          <li>light and dark themes with a persistent user choice;</li>
          <li>reduced-motion treatment for non-essential animation;</li>
          <li>text alternatives or decorative treatment for visual assets;</li>
          <li>labelled form fields, clear limits, and announced status messages; and</li>
          <li>plain-text copy and download paths for project briefs.</li>
        </ul>
        <p>
          Automated checks are useful but incomplete. Important journeys should
          also be assessed with keyboard, screen-reader, zoom, reduced-motion,
          and high-contrast scenarios.
        </p>
      </TrustSection>

      <TrustSection id="workspace-access" title="Workspace and generated content">
        <p>
          Canvas and Atlas support text-first project records alongside visual
          views. Structured exports help preserve the underlying content when a
          visual representation is difficult to interpret. Review status is
          communicated in text rather than color alone.
        </p>
        <p>
          Generated prototypes, imported documents, model responses, and code
          supplied by users may not inherit the platform&apos;s accessibility quality.
          Treat them as working material until their headings, names, keyboard
          behavior, contrast, reading order, errors, and alternatives have been
          tested in context.
        </p>
      </TrustSection>

      <TrustSection id="limits" title="Known limits and honest boundaries">
        <TrustCallout>
          <p>
            Some experimental visualizations, complex diagrams, embedded third-
            party content, and user-authored previews may remain difficult to use
            with assistive technology. A live model can describe content, but its
            description is not a substitute for a reviewed alternative.
          </p>
        </TrustCallout>
        <p>
          Browser, operating-system, extension, and third-party service
          combinations can affect behavior. When a function is unavailable or
          inaccessible, copy, download, or a direct project conversation should
          provide a practical alternative wherever possible.
        </p>
      </TrustSection>

      <TrustSection id="feedback" title="Feedback and alternative formats">
        <p>
          If you encounter a barrier, use the public address displayed on the{" "}
          <Link href="/contact">Contact page</Link>. Include the page or function,
          what you were trying to do, the assistive technology and browser if you
          are comfortable sharing them, and the format or adjustment that would
          help. Do not include passwords or confidential project content.
        </p>
        <p>
          Reasonable efforts will be made to acknowledge the report, provide an
          accessible alternative where practicable, and prioritize a durable fix.
          If no public email is configured, the contact worksheet still provides
          copy and download options for use through another trusted channel.
        </p>
      </TrustSection>

      <TrustSection id="assessment" title="Assessment and review">
        <p>
          Accessibility is reviewed during component development, journey tests,
          content editing, and production verification. This statement is updated
          when material capabilities or known limitations change. Independent
          specialist and user testing should be commissioned before the platform
          is represented as conformant for a regulated or high-stakes deployment.
        </p>
      </TrustSection>
    </TrustPage>
  );
}
