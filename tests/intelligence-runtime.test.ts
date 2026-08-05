import assert from "node:assert/strict";
import test from "node:test";

import {
  intelligenceRunRequestSchema,
  intelligenceRunResponseSchema,
  type IntelligenceReview,
  type IntelligenceRunRequest,
} from "../src/lib/intelligence/contracts";
import {
  PHASE_OPERATING_PLANS,
  negotiateCapabilities,
  selectSpecialistRoles,
} from "../src/lib/intelligence/policy";
import {
  containsLikelySecret,
  serializeIntelligenceInput,
} from "../src/lib/intelligence/prompt";
import {
  executeIntelligenceRun,
  executeLocalIntelligenceRun,
  MAX_PROVIDER_CALLS,
  type IntelligenceProvider,
} from "../src/lib/intelligence/runtime";

const ZERO_DIGEST = "0".repeat(64);
const NOW = "2026-08-04T12:00:00.000Z";

function request(overrides: Partial<IntelligenceRunRequest> = {}) {
  return intelligenceRunRequestSchema.parse({
    mode: "idea",
    title: "Neighbourhood skills exchange",
    text: "Residents exchange one-hour lessons. Demand and trust assumptions are unresolved.",
    code: { html: "", css: "", javascript: "" },
    objective: "Define the smallest responsible test.",
    depth: "standard",
    projectContext: {
      projectId: "project-test-1",
      objective: "Test whether neighbours will exchange useful skills safely.",
      phase: "discover",
      evidence: [
        {
          id: "evidence-1",
          kind: "note",
          title: "Unverified resident note",
          source: "Workspace note",
          claim: "Three residents said they may participate.",
          addedAt: NOW,
        },
      ],
      decisions: [],
      acceptedRuns: [],
      artifacts: [
        {
          id: "artifact-parent-1",
          title: "Initial concept",
          kind: "workspace-source",
          summary: "An early and unvalidated concept.",
          digest: ZERO_DIGEST,
          createdAt: NOW,
        },
      ],
      artifactRelationships: [],
    },
    context: { codeLogs: [], versions: [] },
    orchestration: { maxSpecialistPasses: 2, requestedRoles: [] },
    capabilityNegotiation: {
      requested: [
        "structured-review",
        "phase-planning",
        "parallel-specialists",
        "project-context",
        "artifact-provenance",
      ],
    },
    ...overrides,
  });
}

const review: IntelligenceReview = {
  summary: "The concept is promising but its audience and trust assumptions remain unresolved.",
  status: "Developing",
  strengths: ["The intended exchange is concrete."],
  uncertainties: ["Representative demand is unknown."],
  failurePoints: ["The trust model is not defined."],
  assumptions: ["Residents will exchange time without payment."],
  nextTest: "Interview five representative residents and record a pre-agreed participation threshold.",
  proposedChanges: ["State the trust boundary and the intended first audience."],
  improvedInput: "Create: a bounded neighbourhood skills-exchange pilot.",
  improvedCode: null,
  buildBrief: {
    title: "Skills exchange pilot",
    oneLine: "A bounded test of resident-to-resident skill exchange.",
    audience: "Residents who want to teach or learn one practical skill.",
    coreExperience: "Offer, discover, and request a one-hour lesson with a clear safety boundary.",
    deliverables: ["Test script", "Decision threshold"],
    complexity: "Focused",
  },
};

test("1. accepts a strict, complete project-intelligence request", () => {
  const parsed = request();
  assert.equal(parsed.projectContext.phase, "discover");
  assert.equal(parsed.orchestration.maxSpecialistPasses, 2);
});

test("2. rejects unknown request fields instead of silently accepting drift", () => {
  const candidate = { ...request(), hiddenAuthority: "deploy" };
  assert.equal(intelligenceRunRequestSchema.safeParse(candidate).success, false);
});

test("3. rejects orchestration above two specialist passes", () => {
  const candidate = {
    ...request(),
    orchestration: { maxSpecialistPasses: 3, requestedRoles: [] },
  };
  assert.equal(intelligenceRunRequestSchema.safeParse(candidate).success, false);
});

test("4. capability negotiation grants review features and declines side effects", () => {
  const result = negotiateCapabilities([
    "structured-review",
    "external-research",
    "code-execution",
    "autonomous-deployment",
  ]);
  assert.deepEqual(result.granted, ["structured-review"]);
  assert.deepEqual(
    result.declined.map((item) => item.capability),
    ["external-research", "code-execution", "autonomous-deployment"],
  );
});

test("5. all six lifecycle phases have a bounded two-role operating plan", () => {
  assert.deepEqual(Object.keys(PHASE_OPERATING_PLANS), [
    "discover",
    "investigate",
    "model",
    "build",
    "validate",
    "launch",
  ]);
  for (const plan of Object.values(PHASE_OPERATING_PLANS)) {
    assert.equal(plan.specialists.length, 2);
    assert.ok(plan.acceptanceCriteria.length >= 2);
  }
});

test("6. specialist selection remains phase-bound and capped", () => {
  assert.deepEqual(selectSpecialistRoles("build", ["delivery", "prototype"], 2), [
    "prototype",
  ]);
  assert.deepEqual(selectSpecialistRoles("validate", [], 1), ["validation"]);
  assert.deepEqual(selectSpecialistRoles("launch", [], 0), []);
});

test("7. canonical envelopes carry project evidence and use fresh 256-bit boundaries", () => {
  const parsed = request();
  const negotiation = negotiateCapabilities(parsed.capabilityNegotiation.requested);
  const first = serializeIntelligenceInput(parsed, negotiation);
  const second = serializeIntelligenceInput(parsed, negotiation);
  assert.equal(first.inputDigest, second.inputDigest);
  assert.notEqual(first.prompt, second.prompt);
  assert.match(first.prompt, /KX_CANONICAL_PROJECT_UNTRUSTED_DATA_BEGIN_[a-f0-9]{64}/);
  assert.ok(first.payload.includes("Three residents said they may participate."));
});

test("8. likely credentials are detected before a provider call", () => {
  assert.equal(containsLikelySecret(`token=sk-${"a".repeat(32)}`), true);
  assert.equal(containsLikelySecret("ordinary project text"), false);
});

test("9. deterministic fallback returns valid phase, pass, artifact, and lineage records", () => {
  const result = executeLocalIntelligenceRun(request(), {
    now: () => new Date(NOW),
  });
  assert.equal(intelligenceRunResponseSchema.safeParse(result).success, true);
  assert.equal(result.status, "local-fallback");
  assert.equal(result.orchestration.passes.length, 2);
  assert.equal(result.provenance.providerCalls.length, 0);
  assert.ok(result.artifacts.some((item) => item.id === result.provenance.finalArtifactId));
  assert.deepEqual(result.provenance.parentArtifactIds, ["artifact-parent-1"]);

  const emptyCodeResult = executeLocalIntelligenceRun(
    request({ mode: "code", text: "", code: { html: "", css: "", javascript: "" } }),
    { now: () => new Date(NOW) },
  );
  assert.ok(emptyCodeResult.review.improvedCode?.html);
  assert.equal(
    emptyCodeResult.review.improvedInput,
    emptyCodeResult.review.improvedCode?.html,
  );

  const maximumTextResult = executeLocalIntelligenceRun(
    request({ text: `Purpose: ${"x".repeat(21_990)}` }),
    { now: () => new Date(NOW) },
  );
  assert.ok(maximumTextResult.review.improvedInput.length <= 20_000);
  assert.ok(maximumTextResult.review.buildBrief.coreExperience.length <= 900);
});

test("10. provider orchestration is capped at four calls and records every stage", async () => {
  let calls = 0;
  const provider: IntelligenceProvider = {
    async plan(_prompt, _depth, model) {
      calls += 1;
      return {
        model,
        output: {
          summary: "Coordinate discovery and evidence without claiming validation.",
          phaseObjective: "Bound the first responsible test.",
          sequence: ["Frame", "Audit", "Synthesize"],
          acceptanceCriteria: ["Assumptions remain explicit."],
          conflicts: [],
          boundaries: ["No external side effects."],
          handoff: "Move to investigation after evidence is recorded.",
        },
      };
    },
    async specialize(_role, _prompt, _depth, model) {
      calls += 1;
      return { model, output: review };
    },
    async synthesize(_prompt, _depth, model) {
      calls += 1;
      return { model, output: review };
    },
  };
  const result = await executeIntelligenceRun(request(), {
    requestSignal: new AbortController().signal,
    safetyIdentifier: "test-identity",
    provider,
    now: () => new Date(NOW),
  });
  assert.equal(result.status, "completed");
  assert.equal(calls, MAX_PROVIDER_CALLS);
  assert.equal(result.provenance.providerCalls.length, MAX_PROVIDER_CALLS);
  assert.deepEqual(
    result.provenance.providerCalls.map((item) => item.stage),
    ["plan", "specialist", "specialist", "synthesis"],
  );
});
