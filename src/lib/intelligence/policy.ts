import type { PlatformPhase } from "@/lib/platform/types";

import {
  intelligenceCapabilities,
  supportedIntelligenceCapabilities,
  type IntelligenceCapability,
  type IntelligencePlan,
  type IntelligenceSpecialistRole,
} from "@/lib/intelligence/contracts";

type PhaseOperatingPlan = Readonly<{
  objective: string;
  specialists: readonly [IntelligenceSpecialistRole, IntelligenceSpecialistRole];
  mandates: Readonly<Record<IntelligenceSpecialistRole, string>>;
  sequence: readonly string[];
  acceptanceCriteria: readonly string[];
  handoff: string;
}>;

const sharedMandates: Readonly<Record<IntelligenceSpecialistRole, string>> = {
  discovery:
    "Clarify the people, problem, intended change, constraints, assumptions, and smallest responsible discovery test.",
  evidence:
    "Audit claims against supplied evidence, expose counter-evidence and gaps, and never imply external validation occurred.",
  systems:
    "Map relationships, interfaces, state changes, dependencies, constraints, and recoverable failure paths.",
  prototype:
    "Strengthen the proposed artifact into a complete, accessible, testable prototype without executing or publishing it.",
  validation:
    "Challenge the concept against explicit acceptance criteria, accessibility, privacy, safety, and falsifiable tests.",
  delivery:
    "Turn accepted evidence and decisions into a bounded implementation and handoff sequence without deploying it.",
};

export const PHASE_OPERATING_PLANS: Readonly<Record<PlatformPhase, PhaseOperatingPlan>> = {
  discovery: {
    objective:
      "Convert the initial intention into a bounded problem, audience, outcome, constraint set, and responsible first test.",
    specialists: ["discovery", "evidence"],
    mandates: sharedMandates,
    sequence: [
      "Separate the stated intention from assumptions.",
      "Identify the people affected and the smallest useful evidence gap.",
      "Define the decision the first test must enable.",
    ],
    acceptanceCriteria: [
      "Audience, problem, desired change, constraints, and uncertainty are explicit.",
      "The next test is bounded and does not claim validation before evidence exists.",
    ],
    handoff: "Advance to Investigate with a testable problem frame and an evidence plan.",
  },
  evidence: {
    objective:
      "Distinguish supported claims from assumptions and assemble the minimum evidence needed for a defensible direction.",
    specialists: ["evidence", "discovery"],
    mandates: sharedMandates,
    sequence: [
      "Inventory claims, sources, gaps, and counter-evidence.",
      "Relate evidence gaps to affected people and decisions.",
      "Name what remains unknown and how it can be tested.",
    ],
    acceptanceCriteria: [
      "Every important claim is labelled as supplied evidence, inference, or unresolved assumption.",
      "The investigation yields a specific decision threshold rather than a generic research task.",
    ],
    handoff: "Advance to Model with traceable evidence and explicitly unresolved uncertainty.",
  },
  systems: {
    objective:
      "Create a coherent system model whose relationships, dependencies, failure paths, and evidence links can be inspected.",
    specialists: ["systems", "evidence"],
    mandates: sharedMandates,
    sequence: [
      "Map actors, artifacts, interfaces, decisions, and state changes.",
      "Connect critical relationships to supplied evidence or mark them unresolved.",
      "Identify failure paths and the assumptions most likely to invalidate the model.",
    ],
    acceptanceCriteria: [
      "The model names inputs, outputs, dependencies, ownership, and failure recovery.",
      "Relationships are not presented as causal or validated without evidence.",
    ],
    handoff: "Advance to Build with a bounded architecture and explicit acceptance criteria.",
  },
  prototype: {
    objective:
      "Turn the model into a coherent, accessible prototype that preserves provenance and can be evaluated safely.",
    specialists: ["prototype", "systems"],
    mandates: sharedMandates,
    sequence: [
      "Prioritize the smallest complete user path.",
      "Specify interface states, data boundaries, accessibility, and recovery behavior.",
      "Preserve project intent and provenance in the proposed artifact.",
    ],
    acceptanceCriteria: [
      "The proposal is complete enough to test without silently adding unsupported claims.",
      "Keyboard access, responsive behavior, failure recovery, and privacy boundaries are explicit.",
    ],
    handoff: "Advance to Validate with a complete prototype proposal and falsifiable criteria.",
  },
  validation: {
    objective:
      "Test whether the proposed experience satisfies its stated purpose without concealing uncertainty, risk, or failure.",
    specialists: ["validation", "evidence"],
    mandates: sharedMandates,
    sequence: [
      "Translate intended outcomes into observable acceptance criteria.",
      "Challenge accessibility, privacy, safety, edge cases, and evidence quality.",
      "Define pass, revise, and stop conditions for the next test.",
    ],
    acceptanceCriteria: [
      "Every test states what is observed, what is not measured, and which decision follows.",
      "No proposed test is described as completed unless its result exists in project evidence.",
    ],
    handoff: "Advance to Deliver only after evidence supports the release decision and its limits.",
  },
  delivery: {
    objective:
      "Prepare a governed release and handoff that makes dependencies, ownership, evidence, rollback, and next decisions explicit.",
    specialists: ["delivery", "validation"],
    mandates: sharedMandates,
    sequence: [
      "Sequence bounded deliverables, owners, dependencies, and release decisions.",
      "Carry validation limits, monitoring signals, and rollback criteria into the handoff.",
      "Name the next responsible build step without implying deployment occurred.",
    ],
    acceptanceCriteria: [
      "The handoff distinguishes proposed work, accepted decisions, and completed evidence.",
      "Release, monitoring, and rollback responsibilities are explicit and human-approved.",
    ],
    handoff: "Move to an accountable build or release workflow with a reviewable project record.",
  },
};

export function negotiateCapabilities(
  requested: readonly IntelligenceCapability[],
) {
  const supported = new Set<IntelligenceCapability>(supportedIntelligenceCapabilities);
  const unique = [...new Set(requested)].filter((capability) =>
    intelligenceCapabilities.includes(capability),
  );
  return {
    requested: unique,
    granted: unique.filter((capability) => supported.has(capability)),
    declined: unique
      .filter((capability) => !supported.has(capability))
      .map((capability) => ({
        capability,
        reason:
          capability === "external-research"
            ? "This governed workspace run has no browsing or external-research tool. Add verified evidence to the project ledger instead."
            : capability === "code-execution"
              ? "The intelligence runtime reviews source but does not execute untrusted code."
              : "Deployment remains a separate, explicit, human-reviewed action and cannot be granted to this run.",
      })),
  };
}

export function selectSpecialistRoles(
  phase: PlatformPhase,
  requestedRoles: readonly IntelligenceSpecialistRole[],
  maximum: number,
) {
  if (maximum <= 0) return [];
  const phaseRoles = PHASE_OPERATING_PLANS[phase].specialists;
  const requested = [...new Set(requestedRoles)].filter((role) =>
    phaseRoles.includes(role),
  );
  const selected = requested.length ? requested : [...phaseRoles];
  return selected.slice(0, Math.min(2, maximum));
}

export function buildGovernedPhasePlan(
  phase: PlatformPhase,
  specialists: readonly IntelligenceSpecialistRole[],
  modelPlan?: Readonly<{
    summary: string;
    phaseObjective: string;
    sequence: readonly string[];
    acceptanceCriteria: readonly string[];
    conflicts: readonly string[];
    boundaries: readonly string[];
    handoff: string;
  }>,
): IntelligencePlan {
  const policy = PHASE_OPERATING_PLANS[phase];
  return {
    phase,
    summary:
      modelPlan?.summary ||
      `Conductor will coordinate ${specialists.length || "no"} specialist pass${specialists.length === 1 ? "" : "es"} for the ${phase} phase.`,
    phaseObjective: modelPlan?.phaseObjective || policy.objective,
    specialists: specialists.map((role) => ({
      role,
      mandate: policy.mandates[role],
      expectedContribution: `A bounded ${role} review tied to the supplied workspace and project ledger.`,
    })),
    sequence: [...(modelPlan?.sequence?.length ? modelPlan.sequence : policy.sequence)],
    acceptanceCriteria: [
      ...(modelPlan?.acceptanceCriteria?.length
        ? modelPlan.acceptanceCriteria
        : policy.acceptanceCriteria),
    ],
    conflicts: [...(modelPlan?.conflicts || [])],
    boundaries: [
      ...(modelPlan?.boundaries?.length
        ? modelPlan.boundaries
        : [
            "No browsing, code execution, deployment, purchasing, messaging, or external side effects.",
            "Supplied project evidence remains distinct from inference and unresolved assumptions.",
          ]),
    ],
    handoff: modelPlan?.handoff || policy.handoff,
  };
}
