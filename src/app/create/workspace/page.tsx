import type { Metadata } from "next";

import { CreativeWorkspace } from "@/components/workspace/CreativeWorkspace";
import {
  normalizePlatformPhase,
  type PlatformPhase,
} from "@/lib/platform/types";
import { workspaceModes, type WorkspaceMode } from "@/lib/workspace/types";

export const metadata: Metadata = {
  title: "Kingxford Canvas — Project workspace",
  description:
    "Develop ideas, run front-end prototypes, map systems, evaluate prompts, shape briefs, and prepare a project for implementation in Kingxford Canvas.",
  alternates: { canonical: "/create/workspace" },
  openGraph: {
    title: "Kingxford Canvas — Develop an idea into a testable prototype",
    description:
      "A dual-pane project workspace for ideas, code, mind maps, prompts, briefs, live previews, structured review, and implementation handoff.",
    type: "website",
    url: "/create/workspace",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kingxford Canvas",
    description:
      "Develop an idea and inspect its preview in the same workspace.",
  },
};

type CreativeWorkspacePageProps = Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>;

function resolveWorkspaceMode(value: string | string[] | undefined): WorkspaceMode | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return workspaceModes.find((mode) => mode === candidate) ?? null;
}

function resolvePlatformPhase(value: string | string[] | undefined): PlatformPhase | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return normalizePlatformPhase(candidate);
}

export default async function CreativeWorkspacePage({
  searchParams,
}: CreativeWorkspacePageProps) {
  const query = await searchParams;
  const initialMode = resolveWorkspaceMode(query.mode);
  const initialPhase = resolvePlatformPhase(query.phase);
  const startFromSeed = (Array.isArray(query.start) ? query.start[0] : query.start) === "seed";
  const entrepreneurshipUrl =
    process.env.NEXT_PUBLIC_AI_ENTREPRENEURSHIP_URL?.trim() || null;

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Kingxford Canvas",
    url: "https://kingxford.co/create/workspace",
    applicationCategory: "DesignApplication",
    operatingSystem: "Any modern web browser",
    browserRequirements: "Requires JavaScript",
    description:
      "A local-first project workspace for developing ideas, front-end prototypes, mind maps, prompts, and implementation briefs with live previews and optional structured review.",
    featureList: [
      "Dual-pane input and live preview",
      "Isolated HTML, CSS and JavaScript preview",
      "Mind-map and prompt inspection",
      "Local version history and export",
      "Optional structured project review",
      "Implementation planning handoff",
    ],
    creator: {
      "@type": "Organization",
      name: "kingXford & Co",
      url: "https://kingxford.co",
    },
  };

  return (
    <>
      <script
        id="kingxford-canvas-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <CreativeWorkspace
        entrepreneurshipUrl={entrepreneurshipUrl}
        initialMode={initialMode}
        initialPhase={initialPhase}
        startFromSeed={startFromSeed}
      />
    </>
  );
}
