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
  WORKSPACE_VERSION_LIMIT,
  adoptWorkspaceVersions,
  createWorkspaceProject,
  createWorkspaceVersionHistory,
  parseWorkspaceVersionHistory,
  pruneWorkspaceVersions,
  recordWorkspaceVersion,
  serializeWorkspaceProjectBundle,
  serializeWorkspaceVersionHistory,
  workspaceVersionsForProject,
} from "../src/lib/workspace/storage";
import type { WorkspaceVersion } from "../src/lib/workspace/types";

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

function version(
  id: string,
  overrides: Partial<WorkspaceVersion> = {},
): WorkspaceVersion {
  return {
    id,
    name: `Checkpoint ${id}`,
    createdAt: "2026-08-10T09:00:00.000Z",
    source: "manual",
    draft: {
      mode: "idea",
      title: "Checkpoint",
      text: "A saved checkpoint",
      code: { html: "", css: "", javascript: "" },
    },
    ...overrides,
  };
}

test("stored versions carry the identity of the project they belong to", () => {
  const project = createWorkspaceProject({
    ...content,
    versions: [version("v1"), version("v2", { projectId: "another-project" })],
  });

  assert.deepEqual(
    project.versions.map(({ projectId }) => projectId),
    [project.id, project.id],
  );
  assert.equal(workspaceVersionsForProject(project.versions, project.id).length, 2);
  assert.equal(workspaceVersionsForProject(project.versions, "another-project").length, 0);
});

test("versions saved before project identity are adopted rather than discarded", () => {
  const adopted = adoptWorkspaceVersions(
    [version("legacy-1"), version("legacy-2", { projectId: "owned" })],
    "adopting-project",
  );

  assert.deepEqual(
    adopted.map(({ projectId }) => projectId),
    ["adopting-project", "owned"],
  );
  assert.equal(adopted.length, 2);
});

test("recording a version keeps each project inside its own capped slots", () => {
  let versions: readonly WorkspaceVersion[] = [];
  for (let index = 0; index < WORKSPACE_VERSION_LIMIT + 4; index += 1) {
    versions = recordWorkspaceVersion(
      versions,
      version(`alpha-${index}`, { projectId: "alpha" }),
    );
    versions = recordWorkspaceVersion(
      versions,
      version(`beta-${index}`, { projectId: "beta" }),
    );
  }

  assert.equal(workspaceVersionsForProject(versions, "alpha").length, WORKSPACE_VERSION_LIMIT);
  assert.equal(workspaceVersionsForProject(versions, "beta").length, WORKSPACE_VERSION_LIMIT);
  assert.equal(versions[0]?.id, `beta-${WORKSPACE_VERSION_LIMIT + 3}`);
  assert.equal(
    pruneWorkspaceVersions(versions, ["alpha"]).every(({ projectId }) => projectId === "alpha"),
    true,
  );
});

test("version history round-trips through storage with its project identity intact", () => {
  const history = createWorkspaceVersionHistory([
    version("kept", { projectId: "alpha" }),
    version("other", { projectId: "beta" }),
  ]);
  const restored = parseWorkspaceVersionHistory(
    serializeWorkspaceVersionHistory(history),
  );

  assert.deepEqual(
    restored.versions.map(({ id, projectId }) => [id, projectId]),
    [["kept", "alpha"], ["other", "beta"]],
  );
  assert.throws(
    () => parseWorkspaceVersionHistory(JSON.stringify({ schemaVersion: 9, versions: [] })),
    /unsupported format version/,
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
