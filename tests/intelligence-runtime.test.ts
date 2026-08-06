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
  validateIntelligenceProjectBinding,
  type IntelligenceProvider,
} from "../src/lib/intelligence/runtime";
import {
  appendArtifactRevision,
  codeRevisionBody,
  createKingxfordProject,
  textRevisionBody,
  type ArtifactKind,
} from "../src/lib/workspace/project-graph";
import { buildProjectSnapshot } from "../src/lib/workspace/project-snapshot-schema";

const ZERO_DIGEST = "0".repeat(64);
const NOW = "2026-08-04T12:00:00.000Z";

const modeArtifactKind = {
  idea: "idea",
  code: "code",
  mindmap: "system-map",
  prompt: "prompt",
  brief: "brief",
} as const satisfies Record<IntelligenceRunRequest["mode"], ArtifactKind>;

function requestCandidate(overrides: Partial<IntelligenceRunRequest> = {}) {
  const base = {
    mode: "idea" as const,
    title: "Neighbourhood skills exchange",
    text: "Residents exchange one-hour lessons. Demand and trust assumptions are unresolved.",
    code: { html: "", css: "", javascript: "" },
    objective: "Define the smallest responsible test.",
    depth: "standard" as const,
    projectContext: {
      projectId: "placeholder-project",
      objective: "Test whether neighbours will exchange useful skills safely.",
      phase: "discovery" as const,
      evidence: [
        {
          id: "evidence-1",
          kind: "note" as const,
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
          kind: "workspace-source" as const,
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
        "structured-review" as const,
        "phase-planning" as const,
        "parallel-specialists" as const,
        "project-context" as const,
        "artifact-provenance" as const,
      ],
    },
  };
  const draft = {
    ...base,
    ...overrides,
    projectContext: {
      ...base.projectContext,
      ...(overrides.projectContext || {}),
    },
  };
  let project = createKingxfordProject({
    title: draft.title || "Test project",
    summary: draft.projectContext.objective,
    activePhase: draft.projectContext.phase,
    createdAt: NOW,
    idSeed: `intelligence-runtime-${draft.mode}-${draft.projectContext.phase}`,
  });
  project = appendArtifactRevision(project, {
    kind: modeArtifactKind[draft.mode],
    title: draft.title || "Test artifact",
    phase: draft.projectContext.phase,
    body:
      draft.mode === "code"
        ? codeRevisionBody(draft.code)
        : textRevisionBody(draft.text),
    source: "human",
    createdAt: NOW,
  });
  const snapshot = buildProjectSnapshot(project, {
    activeArtifactId: project.activeArtifactId,
  });
  const artifact = snapshot.artifacts.find(
    (candidate) => candidate.id === project.activeArtifactId,
  );
  assert.ok(artifact);

  return {
    ...draft,
    projectContext: {
      ...draft.projectContext,
      projectId: project.id,
    },
    projectGraphSnapshot: overrides.projectGraphSnapshot || snapshot,
    artifactRevisionId:
      overrides.artifactRevisionId || artifact.activeRevision.id,
  };
}

function request(overrides: Partial<IntelligenceRunRequest> = {}) {
  return intelligenceRunRequestSchema.parse(requestCandidate(overrides));
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

test("1. accepts a strict request bound to an integrity-checked Atlas revision", () => {
  const parsed = request();
  const binding = validateIntelligenceProjectBinding(parsed);
  assert.equal(parsed.projectContext.phase, "discovery");
  assert.equal(parsed.orchestration.maxSpecialistPasses, 2);
  assert.equal(binding.snapshotHash, parsed.projectGraphSnapshot.hash);
  assert.equal(binding.artifactRevisionId, parsed.artifactRevisionId);
  assert.equal(binding.draftHash, parsed.projectGraphSnapshot.artifacts[0].activeRevision.contentHash);
});

test("2. rejects requests missing either required Atlas binding field", () => {
  const withoutSnapshot = { ...request() } as Record<string, unknown>;
  delete withoutSnapshot.projectGraphSnapshot;
  assert.equal(intelligenceRunRequestSchema.safeParse(withoutSnapshot).success, false);

  const withoutRevision = { ...request() } as Record<string, unknown>;
  delete withoutRevision.artifactRevisionId;
  assert.equal(intelligenceRunRequestSchema.safeParse(withoutRevision).success, false);
});

test("3. rejects unknown request fields instead of silently accepting drift", () => {
  const candidate = { ...request(), hiddenAuthority: "deploy" };
  assert.equal(intelligenceRunRequestSchema.safeParse(candidate).success, false);
});

test("4. rejects orchestration above two specialist passes", () => {
  const candidate = {
    ...request(),
    orchestration: { maxSpecialistPasses: 3, requestedRoles: [] },
  };
  assert.equal(intelligenceRunRequestSchema.safeParse(candidate).success, false);
});

test("5. capability negotiation grants analysis and declines side effects", () => {
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

test("6. all six canonical lifecycle phases have a bounded operating plan", () => {
  assert.deepEqual(Object.keys(PHASE_OPERATING_PLANS), [
    "discovery",
    "evidence",
    "systems",
    "prototype",
    "validation",
    "delivery",
  ]);
  for (const plan of Object.values(PHASE_OPERATING_PLANS)) {
    assert.equal(plan.specialists.length, 2);
    assert.ok(plan.acceptanceCriteria.length >= 2);
  }
});

test("7. specialist selection remains phase-bound and capped", () => {
  assert.deepEqual(selectSpecialistRoles("prototype", ["delivery", "prototype"], 2), [
    "prototype",
  ]);
  assert.deepEqual(selectSpecialistRoles("validation", [], 1), ["validation"]);
  assert.deepEqual(selectSpecialistRoles("delivery", [], 0), []);
});

test("8. canonical envelopes bind Atlas context and use fresh 256-bit boundaries", () => {
  const parsed = request();
  const negotiation = negotiateCapabilities(parsed.capabilityNegotiation.requested);
  const first = serializeIntelligenceInput(parsed, negotiation);
  const second = serializeIntelligenceInput(parsed, negotiation);
  assert.equal(first.inputDigest, second.inputDigest);
  assert.notEqual(first.prompt, second.prompt);
  assert.match(first.prompt, /KX_CANONICAL_PROJECT_UNTRUSTED_DATA_BEGIN_[a-f0-9]{64}/);
  assert.ok(first.payload.includes("Three residents said they may participate."));
  assert.ok(first.payload.includes(parsed.projectGraphSnapshot.hash));
  assert.ok(first.payload.includes(parsed.artifactRevisionId));
});

test("9. likely credentials are detected before a provider call", () => {
  assert.equal(containsLikelySecret(`token=sk-${"a".repeat(32)}`), true);
  assert.equal(
    containsLikelySecret(`API_KEY=${"A".repeat(24)}`),
    true,
  );
  assert.equal(containsLikelySecret("ordinary project text"), false);
});

test("10. Atlas binding rejects stale drafts, inactive revisions, and mode drift", () => {
  const parsed = request();
  assert.throws(
    () =>
      validateIntelligenceProjectBinding({
        ...parsed,
        text: `${parsed.text} Changed after snapshot.`,
      }),
    /workspace draft no longer matches/i,
  );
  assert.throws(
    () =>
      validateIntelligenceProjectBinding({
        ...parsed,
        artifactRevisionId: "revision-that-is-not-active",
      }),
    /artifact revision is not active/i,
  );
  assert.throws(
    () =>
      validateIntelligenceProjectBinding({
        ...parsed,
        mode: "brief",
      }),
    /does not match the active workspace mode/i,
  );
});

test("11. deterministic fallback echoes Atlas binding and zero provider usage", () => {
  const parsed = request();
  const result = executeLocalIntelligenceRun(parsed, {
    now: () => new Date(NOW),
    runId: "test-local-run",
  });
  assert.equal(intelligenceRunResponseSchema.safeParse(result).success, true);
  assert.equal(result.runId, "test-local-run");
  assert.equal(result.status, "local-fallback");
  assert.equal(result.orchestration.passes.length, 2);
  assert.equal(result.provenance.providerCalls.length, 0);
  assert.deepEqual(result.provenance.usage, {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  });
  assert.deepEqual(result.projectContext, validateIntelligenceProjectBinding(parsed));
  assert.ok(result.artifacts.some((item) => item.id === result.provenance.finalArtifactId));
  assert.ok(result.provenance.parentArtifactIds.includes("artifact-parent-1"));
  assert.ok(result.provenance.parentArtifactIds.includes(result.projectContext.artifactId));
  assert.match(result.notice || "", /gate approval/i);
});

test("12. local code and maximum text fallbacks stay within response bounds", () => {
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

test("13. Conductor runs plan, two parallel specialists, then synthesis within four calls", async () => {
  let calls = 0;
  let activeSpecialists = 0;
  let maximumParallelSpecialists = 0;
  const requestedModels: string[] = [];
  const provider: IntelligenceProvider = {
    async plan(_prompt, _depth, model) {
      calls += 1;
      requestedModels.push(model);
      return {
        model,
        usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
        output: {
          summary: "Coordinate discovery and evidence without claiming validation.",
          phaseObjective: "Bound the first responsible test.",
          sequence: ["Frame", "Audit", "Synthesize"],
          acceptanceCriteria: ["Assumptions remain explicit."],
          conflicts: [],
          boundaries: ["No external side effects."],
          handoff: "Move to evidence after evidence is recorded.",
        },
      };
    },
    async specialize(role, _prompt, _depth, model) {
      calls += 1;
      requestedModels.push(model);
      activeSpecialists += 1;
      maximumParallelSpecialists = Math.max(
        maximumParallelSpecialists,
        activeSpecialists,
      );
      await new Promise<void>((resolve) => setImmediate(resolve));
      activeSpecialists -= 1;
      return {
        model: role === "evidence" ? "anthropic/claude-sonnet-4.6" : model,
        usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
        output: review,
      };
    },
    async synthesize(_prompt, _depth, model) {
      calls += 1;
      requestedModels.push(model);
      return {
        model,
        usage: { inputTokens: 30, outputTokens: 8, totalTokens: 38 },
        output: review,
      };
    },
  };
  const result = await executeIntelligenceRun(request(), {
    requestSignal: new AbortController().signal,
    safetyIdentifier: "test-identity",
    provider,
    now: () => new Date(NOW),
    runId: "test-provider-run",
  });
  assert.equal(result.status, "completed");
  assert.equal(result.runId, "test-provider-run");
  assert.equal(calls, MAX_PROVIDER_CALLS);
  assert.equal(maximumParallelSpecialists, 2);
  assert.equal(result.provenance.providerCalls.length, MAX_PROVIDER_CALLS);
  assert.deepEqual(
    result.provenance.providerCalls.map((item) => item.stage),
    ["plan", "specialist", "specialist", "synthesis"],
  );
  assert.deepEqual(result.provenance.usage, {
    inputTokens: 80,
    outputTokens: 20,
    totalTokens: 100,
  });
  assert.ok(
    result.provenance.providerCalls.some(
      (item) => item.model === "anthropic/claude-sonnet-4.6",
    ),
  );
  assert.match(result.notice || "", /Gateway.*fallback/i);
  assert.equal(new Set(requestedModels).size, 1);
});

test("14. a failed plan uses one paid attempt and falls back locally without manual retry", async () => {
  let calls = 0;
  const provider: IntelligenceProvider = {
    async plan() {
      calls += 1;
      throw Object.assign(new Error("provider unavailable"), { statusCode: 503 });
    },
    async specialize() {
      throw new Error("specialist must not run after a failed plan");
    },
    async synthesize() {
      throw new Error("synthesis must not run after a failed plan");
    },
  };
  const result = await executeIntelligenceRun(request(), {
    requestSignal: new AbortController().signal,
    safetyIdentifier: "test-identity",
    provider,
    now: () => new Date(NOW),
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "local-fallback");
  assert.equal(result.provenance.providerCalls.length, 1);
  assert.equal(result.provenance.providerCalls[0].failureCode, "provider-unavailable");
  assert.deepEqual(result.provenance.usage, {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  });
});
