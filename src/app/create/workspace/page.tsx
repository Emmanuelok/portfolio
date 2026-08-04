import type { Metadata } from "next";

import { CreativeWorkspace } from "@/components/workspace/CreativeWorkspace";
import { platformPhases, type PlatformPhase } from "@/lib/platform/types";
import { workspaceModes, type WorkspaceMode } from "@/lib/workspace/types";

export const metadata: Metadata = {
  title: "Kingxford Canvas — Creative intelligence workspace",
  description:
    "Develop ideas, test front-end code, map systems, evaluate prompts, shape briefs, and move a working concept toward production in Kingxford Canvas.",
  alternates: { canonical: "/create/workspace" },
  openGraph: {
    title: "Kingxford Canvas — Move from first thought to working proof",
    description:
      "A dual-pane creative workspace for ideas, code, mind maps, prompts, briefs, live previews, rigorous AI review, and production handoff.",
    type: "website",
    url: "/create/workspace",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kingxford Canvas",
    description:
      "Develop an idea and inspect its working proof—always in view.",
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
  return platformPhases.find((phase) => phase === candidate) ?? null;
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
      "A local-first creative intelligence workspace for testing ideas, front-end code, mind maps, prompts, and implementation briefs with live previews and optional AI review.",
    featureList: [
      "Dual-pane input and live preview",
      "Isolated HTML, CSS and JavaScript preview",
      "Mind-map and prompt inspection",
      "Local version history and export",
      "Optional Kingxford Agent review",
      "Production build handoff",
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
        key={initialMode ?? "saved-workspace"}
        entrepreneurshipUrl={entrepreneurshipUrl}
        initialMode={initialMode}
        initialPhase={initialPhase}
        startFromSeed={startFromSeed}
      />
    </>
  );
}
