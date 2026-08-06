export const PLATFORM_DESTINATIONS = [
  {
    href: "/",
    label: "Mission",
    description: "The shared purpose and operating system",
    keywords: "home mission kingxford platform intelligence",
  },
  {
    href: "/work",
    label: "Work",
    description: "Evidence, systems, and outcomes in practice",
    keywords: "work projects case studies outcomes evidence",
  },
  {
    href: "/lab",
    label: "Lab",
    description: "Research, experiments, and open questions",
    keywords: "lab research development experiments questions",
  },
  {
    href: "/media",
    label: "Field notes",
    description: "Ideas and evidence worth carrying forward",
    keywords: "media field notes articles evidence ideas",
  },
  {
    href: "/create/workspace",
    label: "Canvas",
    description: "Move a project through the complete Atlas",
    keywords: "canvas project workspace atlas build prototype review",
  },
] as const;

export type PlatformDestination = (typeof PLATFORM_DESTINATIONS)[number];

export const PLATFORM_PHASES = [
  {
    id: "discovery",
    number: "01",
    title: "Discovery",
    verb: "Frame",
    description: "Clarify the need, people, context, and success conditions.",
    signal: "A consequential question with an accountable owner",
    conductor: "Surfaces assumptions and routes the project toward evidence.",
    gate: "A person confirms that the problem is worth solving.",
  },
  {
    id: "evidence",
    number: "02",
    title: "Evidence",
    verb: "Ground",
    description: "Collect sources, observations, constraints, and dissent.",
    signal: "Claims connected to inspectable sources and uncertainty",
    conductor: "Distinguishes what is known from what still needs verification.",
    gate: "A person decides whether the evidence is sufficient to proceed.",
  },
  {
    id: "systems",
    number: "03",
    title: "Systems",
    verb: "Model",
    description: "Map actors, relationships, risks, decisions, and leverage.",
    signal: "A model whose logic, gaps, and consequences can be challenged",
    conductor: "Connects evidence into a coherent, revisable project model.",
    gate: "A person approves the model and accepts its stated limitations.",
  },
  {
    id: "prototype",
    number: "04",
    title: "Prototype",
    verb: "Make",
    description: "Turn the strongest proposition into something testable.",
    signal: "A bounded artifact tied to the project model and its evidence",
    conductor: "Coordinates specialist lenses without silently applying changes.",
    gate: "A person chooses which proposal becomes an official revision.",
  },
  {
    id: "validation",
    number: "05",
    title: "Validation",
    verb: "Test",
    description: "Stress-test usefulness, inclusion, reliability, and risk.",
    signal: "Findings recorded against an exact artifact revision",
    conductor: "Routes critique back to the claim or artifact it actually tests.",
    gate: "A person accepts, rejects, or requests another validation cycle.",
  },
  {
    id: "delivery",
    number: "06",
    title: "Delivery",
    verb: "Release",
    description: "Prepare a traceable release, decision, and next learning loop.",
    signal: "An approved outcome with provenance, ownership, and follow-up",
    conductor: "Assembles the handoff while preserving lineage and open questions.",
    gate: "A person authorizes release; the platform never self-approves.",
  },
] as const;

export type PlatformPhase = (typeof PLATFORM_PHASES)[number];
export type PlatformPhaseId = PlatformPhase["id"];

export const PLATFORM_NAME = "kingXford Atlas";
export const PLATFORM_CONDUCTOR = {
  name: "Conductor",
  role: "A coordinating intelligence layer across the complete project lifecycle",
  boundary:
    "Conductor can analyse, route, compare, and propose. People remain responsible for approvals, publication, and consequential decisions.",
} as const;

export function isPlatformPhaseId(value: string): value is PlatformPhaseId {
  return PLATFORM_PHASES.some((phase) => phase.id === value);
}
