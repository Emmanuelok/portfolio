import type { WorkspaceMode } from "@/lib/workspace/types";
import type {
  PlatformAgentRole,
  PlatformPhase,
} from "@/lib/platform/types";

export type PlatformAgentDefinition = Readonly<{
  id: PlatformAgentRole;
  label: string;
  shortLabel: string;
  description: string;
  mandate: string;
  phases: readonly PlatformPhase[];
}>;

export type PlatformPhaseDefinition = Readonly<{
  id: PlatformPhase;
  index: string;
  label: string;
  action: string;
  description: string;
  outcome: string;
  primaryMode: WorkspaceMode;
  modes: readonly WorkspaceMode[];
  route: string;
  agents: readonly PlatformAgentRole[];
}>;

export const PLATFORM_ROUTES = {
  home: "/",
  platform: "/create",
  workspace: "/create/workspace",
  lab: "/lab",
  work: "/work",
  media: "/media",
  contact: "/contact",
} as const;

export const PLATFORM_AGENTS: readonly PlatformAgentDefinition[] = [
  {
    id: "conductor",
    label: "Project review",
    shortLabel: "Coordination",
    description: "Reviews the complete project record and coordinates the relevant disciplines.",
    mandate: "Identify the current phase, assemble the relevant context, and recommend the next review step.",
    phases: ["discovery", "evidence", "systems", "prototype", "validation", "delivery"],
  },
  {
    id: "discovery",
    label: "Discovery review",
    shortLabel: "Discovery",
    description: "Clarifies the need, people, stakes, constraints, and intended change.",
    mandate: "Turn an initial brief into a precise problem frame and a useful first hypothesis.",
    phases: ["discovery"],
  },
  {
    id: "evidence",
    label: "Evidence review",
    shortLabel: "Evidence",
    description: "Separates observations, assumptions, unknowns, and evidence requirements.",
    mandate: "Build an auditable evidence plan and expose unsupported claims before they travel downstream.",
    phases: ["evidence", "validation"],
  },
  {
    id: "systems",
    label: "Systems review",
    shortLabel: "Systems",
    description: "Models relationships, dependencies, scenarios, and intervention points.",
    mandate: "Make the whole system legible enough to choose where and how to intervene.",
    phases: ["evidence", "systems"],
  },
  {
    id: "prototype",
    label: "Prototype review",
    shortLabel: "Prototype",
    description: "Converts the selected intervention into a testable experience or implementation.",
    mandate: "Produce the smallest credible working proof while preserving the project intent and constraints.",
    phases: ["systems", "prototype"],
  },
  {
    id: "validation",
    label: "Validation review",
    shortLabel: "Validation",
    description: "Challenges usability, evidence, resilience, accessibility, and failure modes.",
    mandate: "Define and evaluate the tests required before a prototype can responsibly advance.",
    phases: ["validation"],
  },
  {
    id: "delivery",
    label: "Delivery review",
    shortLabel: "Delivery",
    description: "Turns validated work into a scoped release, operating plan, and handoff.",
    mandate: "Make ownership, sequencing, dependencies, measures, and the next release decision explicit.",
    phases: ["delivery"],
  },
] as const;

export const PLATFORM_LIFECYCLE: readonly PlatformPhaseDefinition[] = [
  {
    id: "discovery",
    index: "01",
    label: "Discover",
    action: "Frame the real need",
    description: "Clarify the people, present condition, intended change, constraints, and first useful question.",
    outcome: "A precise opportunity frame",
    primaryMode: "idea",
    modes: ["idea", "prompt"],
    route: "/create/workspace?phase=discovery&mode=idea",
    agents: ["conductor", "discovery"],
  },
  {
    id: "evidence",
    index: "02",
    label: "Investigate",
    action: "Build the evidence base",
    description: "Separate what is observed, inferred, assumed, disputed, and still worth testing.",
    outcome: "An auditable evidence plan",
    primaryMode: "brief",
    modes: ["idea", "mindmap", "brief"],
    route: "/create/workspace?phase=evidence&mode=brief",
    agents: ["conductor", "evidence", "systems"],
  },
  {
    id: "systems",
    index: "03",
    label: "Model",
    action: "Make the system legible",
    description: "Map actors, dependencies, feedback, scenarios, decisions, and possible intervention points.",
    outcome: "A testable system model",
    primaryMode: "mindmap",
    modes: ["mindmap", "prompt", "code"],
    route: "/create/workspace?phase=systems&mode=mindmap",
    agents: ["conductor", "systems", "prototype"],
  },
  {
    id: "prototype",
    index: "04",
    label: "Build",
    action: "Create the working proof",
    description: "Translate the chosen intervention into usable source, behavior, and a visible result.",
    outcome: "A credible working prototype",
    primaryMode: "code",
    modes: ["code", "brief", "prompt"],
    route: "/create/workspace?phase=prototype&mode=code",
    agents: ["conductor", "prototype"],
  },
  {
    id: "validation",
    index: "05",
    label: "Validate",
    action: "Find what must improve",
    description: "Test usefulness, accessibility, evidence, resilience, responsibility, and likely failure points.",
    outcome: "A decision-ready validation record",
    primaryMode: "brief",
    modes: ["brief", "prompt", "code"],
    route: "/create/workspace?phase=validation&mode=brief",
    agents: ["conductor", "validation", "evidence"],
  },
  {
    id: "delivery",
    index: "06",
    label: "Deliver",
    action: "Turn proof into capability",
    description: "Define scope, owners, dependencies, measures, release sequence, and the production handoff.",
    outcome: "A governed delivery plan",
    primaryMode: "brief",
    modes: ["brief", "code"],
    route: "/create/workspace?phase=delivery&mode=brief",
    agents: ["conductor", "delivery"],
  },
] as const;

export const PLATFORM_WORKSPACE_MODES: ReadonlyArray<
  Readonly<{
    id: WorkspaceMode;
    label: string;
    description: string;
    route: string;
  }>
> = [
  { id: "idea", label: "Idea", description: "Frame a need and intended change.", route: "/create/workspace?mode=idea" },
  { id: "code", label: "Code", description: "Build and run a front-end proof.", route: "/create/workspace?mode=code" },
  { id: "mindmap", label: "Mind map", description: "Model a system spatially.", route: "/create/workspace?mode=mindmap" },
  { id: "prompt", label: "Prompt", description: "Design and inspect instructions.", route: "/create/workspace?mode=prompt" },
  { id: "brief", label: "Brief", description: "Shape a governed delivery plan.", route: "/create/workspace?mode=brief" },
] as const;

export const platformRegistry = {
  name: "Kingxford Project Platform",
  promise: "A continuous project record from initial question to delivery.",
  routes: PLATFORM_ROUTES,
  lifecycle: PLATFORM_LIFECYCLE,
  agents: PLATFORM_AGENTS,
  workspaceModes: PLATFORM_WORKSPACE_MODES,
} as const;

export function getPlatformPhase(id: PlatformPhase) {
  return PLATFORM_LIFECYCLE.find((phase) => phase.id === id);
}

export function getPlatformAgent(id: PlatformAgentRole) {
  return PLATFORM_AGENTS.find((agent) => agent.id === id);
}

export function getPrimaryPhaseForMode(mode: WorkspaceMode): PlatformPhaseDefinition {
  return PLATFORM_LIFECYCLE.find((phase) => phase.primaryMode === mode) ?? PLATFORM_LIFECYCLE[0];
}
