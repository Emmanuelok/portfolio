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
    href: "/create",
    label: "Create",
    description: "Seven creation directions, live proofs, and Canvas",
    keywords: "create websites tools systems education canvas atlas prototypes",
  },
] as const;

export type PlatformDestination = (typeof PLATFORM_DESTINATIONS)[number];

export const CREATE_CATALOGUE_DESTINATIONS = [
  {
    index: "01",
    slug: "websites",
    label: "Websites and digital destinations",
    shortLabel: "Websites",
    href: "/create#capability-websites",
    description: "Clear, credible destinations for complex organizations.",
    keywords: "website portal destination publishing content institutional",
  },
  {
    index: "02",
    slug: "digital-tools",
    label: "Digital tools",
    shortLabel: "Digital tools",
    href: "/create#capability-digital-tools",
    description: "Focused utilities shaped around the actual task.",
    keywords: "calculator planner analyzer generator tracker workflow",
  },
  {
    index: "03",
    slug: "institutional-systems",
    label: "Institutional systems",
    shortLabel: "Institutional systems",
    href: "/create#capability-institutional-systems",
    description: "Governed systems for programmes, services, and evidence.",
    keywords: "institution governance approvals programmes services evidence",
  },
  {
    index: "04",
    slug: "research-ai-tools",
    label: "Research and AI tools",
    shortLabel: "Research + AI",
    href: "/create#capability-research-ai-tools",
    description: "Inspectable intelligence for inquiry and verification.",
    keywords: "research ai evidence synthesis retrieval knowledge graph evaluation",
  },
  {
    index: "05",
    slug: "operational-tools",
    label: "Operational tools",
    shortLabel: "Operations",
    href: "/create#capability-operational-tools",
    description: "Dependable visibility across everyday operations.",
    keywords: "operations dashboard field inspection resources requests delivery",
  },
  {
    index: "06",
    slug: "education-tools",
    label: "Education tools",
    shortLabel: "Education",
    href: "/create#capability-education-tools",
    description: "Purposeful learning, feedback, and visible progress.",
    keywords: "education learning curriculum practice feedback students teachers",
  },
  {
    index: "07",
    slug: "personal-tools",
    label: "Everyday personal tools",
    shortLabel: "Everyday tools",
    href: "/create#capability-personal-tools",
    description: "Clarity and agency for difficult everyday choices.",
    keywords: "personal household study decision community planning organizer",
  },
] as const;

export const CREATE_PROOF_DESTINATIONS = [
  {
    index: "01",
    label: "Science",
    href: "/create/lumen-vale-laboratory",
  },
  {
    index: "02",
    label: "Finance",
    href: "/create/meridian-financial-office",
  },
  {
    index: "03",
    label: "Education",
    href: "/create/commonfield-institute",
  },
] as const;

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
