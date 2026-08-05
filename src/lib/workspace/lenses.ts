export const agentLenses = [
  "conductor",
  "discovery",
  "evidence",
  "systems",
  "prototype",
  "validation",
  "delivery",
] as const;

export type AgentLens = (typeof agentLenses)[number];

export type AgentLensDetail = Readonly<{
  label: string;
  shortLabel: string;
  description: string;
  focus: string;
}>;

export const agentLensDetails: Readonly<Record<AgentLens, AgentLensDetail>> = {
  conductor: {
    label: "Conductor",
    shortLabel: "Whole concept",
    description:
      "Coordinates the full review and resolves tensions across desirability, evidence, feasibility, responsibility, and delivery.",
    focus:
      "Preserve the central intention, identify the decisive uncertainty, and produce one coherent next move rather than disconnected advice.",
  },
  discovery: {
    label: "Discovery",
    shortLabel: "Problem and people",
    description:
      "Examines the real problem, intended people, context, alternatives, and value proposition before solution commitment.",
    focus:
      "Separate the stated request from the underlying need; challenge vague audiences and unverified demand with small discovery tests.",
  },
  evidence: {
    label: "Evidence",
    shortLabel: "Claims and confidence",
    description:
      "Audits claims, assumptions, sources, uncertainty, and the boundary between observation and inference.",
    focus:
      "Do not convert plausibility into fact; identify which important claim needs what evidence and how confidence could change.",
  },
  systems: {
    label: "Systems",
    shortLabel: "Dependencies and risk",
    description:
      "Maps actors, dependencies, constraints, feedback, failure modes, and second-order effects.",
    focus:
      "Find hidden coupling, operational bottlenecks, misuse paths, and recovery needs across the wider system and lifecycle.",
  },
  prototype: {
    label: "Prototype",
    shortLabel: "Smallest useful build",
    description:
      "Turns the concept into a focused, testable prototype with the minimum fidelity needed to learn.",
    focus:
      "Reduce scope without removing the core value; specify the smallest artefact and interaction that can answer the decisive question.",
  },
  validation: {
    label: "Validation",
    shortLabel: "Tests and signals",
    description:
      "Designs falsifiable tests, observable signals, decision thresholds, and learning loops.",
    focus:
      "Define what success, failure, and inconclusive evidence look like before testing, including who evaluates and what happens next.",
  },
  delivery: {
    label: "Delivery",
    shortLabel: "Execution and handoff",
    description:
      "Assesses sequencing, ownership, accessibility, quality control, rollout, maintenance, and readiness to ship.",
    focus:
      "Translate the intention into bounded deliverables, dependencies, owners, acceptance criteria, and a reversible release path.",
  },
};

export function isAgentLens(value: unknown): value is AgentLens {
  return typeof value === "string" && agentLenses.includes(value as AgentLens);
}

export function getAgentLensDetails(lens: AgentLens): AgentLensDetail {
  return agentLensDetails[lens];
}

export function getAgentLensInstructions(lens: AgentLens): string {
  const details = getAgentLensDetails(lens);
  return `${details.label} specialist focus: ${details.focus}`;
}
