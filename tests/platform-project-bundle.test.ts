import assert from "node:assert/strict";
import test from "node:test";

import {
  importPlatformProjectBundle,
  PLATFORM_PROJECT_BUNDLE_CHARACTER_LIMIT,
  serializePlatformProjectBundle,
} from "../src/lib/platform/project-bundle";
import {
  createEmptyPlatformSidecar,
  createPlatformProjectIntelligence,
  savePlatformSidecar,
} from "../src/lib/platform/storage";
import {
  createWorkspaceProject,
  serializeWorkspaceProjectBundle,
} from "../src/lib/workspace/storage";

const content = {
  mode: "idea" as const,
  title: "Connected project",
  textByMode: {
    idea: "A useful starting point",
    mindmap: "Project\n  Evidence",
    prompt: "Review the concept",
    brief: "Outcome\nA validated release",
  },
  code: { html: "<main>Proof</main>", css: "", javascript: "" },
  committedCode: { html: "<main>Proof</main>", css: "", javascript: "" },
  versions: [],
};

test("aggregate bundles round-trip editable source and project intelligence", () => {
  const project = createWorkspaceProject(content);
  const intelligence = {
    ...createPlatformProjectIntelligence(project.id, {
      objective: "Validate the complete opportunity",
      phase: "evidence",
      now: "2026-08-04T12:00:00.000Z",
    }),
    evidence: [{
      id: "evidence-1",
      kind: "note" as const,
      title: "Research note",
      source: "Workspace note",
      claim: "The need is observable.",
      addedAt: "2026-08-04T12:00:00.000Z",
    }],
  };

  const imported = importPlatformProjectBundle(
    serializePlatformProjectBundle(project, intelligence),
    [project.id],
  );

  assert.equal(imported.sourceFormat, "platform");
  assert.notEqual(imported.project.id, project.id);
  assert.equal(imported.project.title, project.title);
  assert.equal(imported.intelligence.projectId, imported.project.id);
  assert.equal(imported.intelligence.objective, intelligence.objective);
  assert.deepEqual(imported.intelligence.evidence, intelligence.evidence);
});

test("legacy Canvas bundles remain importable with a safe intelligence record", () => {
  const project = createWorkspaceProject(content);
  const imported = importPlatformProjectBundle(
    serializeWorkspaceProjectBundle(project),
    [project.id],
  );

  assert.equal(imported.sourceFormat, "legacy-canvas");
  assert.notEqual(imported.project.id, project.id);
  assert.equal(imported.intelligence.projectId, imported.project.id);
  assert.equal(imported.intelligence.phase, "discovery");
});

test("export rejects mismatched editable source and intelligence", () => {
  const project = createWorkspaceProject(content);
  const intelligence = createPlatformProjectIntelligence("another-project");
  assert.throws(
    () => serializePlatformProjectBundle(project, intelligence),
    /same project/,
  );
});

test("aggregate parser rejects unknown fields and oversized input", () => {
  const project = createWorkspaceProject(content);
  const intelligence = createPlatformProjectIntelligence(project.id);
  const parsed = JSON.parse(
    serializePlatformProjectBundle(project, intelligence),
  ) as Record<string, unknown>;
  parsed.unexpected = true;
  assert.throws(
    () => importPlatformProjectBundle(JSON.stringify(parsed)),
    /unexpected/,
  );
  assert.throws(
    () => importPlatformProjectBundle("x".repeat(PLATFORM_PROJECT_BUNDLE_CHARACTER_LIMIT + 1)),
    /exceeds/,
  );
});

test("project intelligence storage reports forced quota exhaustion without claiming success", () => {
  const result = savePlatformSidecar(
    {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Storage is full", "QuotaExceededError");
      },
    },
    createEmptyPlatformSidecar(),
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "quota-exceeded");
    assert.match(result.error.message, /no remaining browser storage/i);
  }
});
