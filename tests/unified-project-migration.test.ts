import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_STORAGE_KEY,
  createEmptyPlatformSidecar,
  createPlatformProjectIntelligence,
  serializePlatformSidecar,
} from "../src/lib/platform/storage";
import {
  WORKSPACE_STORAGE_KEY,
  createWorkspaceLibrary,
  createWorkspaceProject,
  serializeWorkspaceLibrary,
} from "../src/lib/workspace/storage";
import {
  PROJECT_REPOSITORY_STORAGE_KEY,
  createEmptyProjectRepository,
  duplicateRepositoryProject,
  loadProjectRepository,
  upsertRepositoryProject,
} from "../src/lib/workspace/project-repository";

const NOW = "2026-08-05T12:00:00.000Z";

function memoryStorage(entries: Readonly<Record<string, string>>) {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    values,
  };
}

function legacyProject() {
  return createWorkspaceProject({
    mode: "idea",
    title: "Unified heat resilience project",
    textByMode: {
      idea: "Libraries and residents need a shared heat evidence exchange.",
      mindmap: "Heat resilience\n  Libraries\n  Residents",
      prompt: "Challenge the evidence boundary.",
      brief: "Deliver an inspectable neighbourhood pilot.",
    },
    code: { html: "<main>Heat evidence</main>", css: "main{}", javascript: "" },
    committedCode: { html: "<main>Heat evidence</main>", css: "main{}", javascript: "" },
    versions: [],
  }, { id: "legacy-project-1", createdAt: NOW, updatedAt: NOW });
}

test("unified-create Canvas v2 and sidecar migrate transactionally into one Atlas repository", () => {
  const legacy = legacyProject();
  const intelligence = {
    ...createPlatformProjectIntelligence(legacy.id, {
      objective: "Establish an evidence-bound neighbourhood heat response.",
      phase: "evidence",
      now: NOW,
    }),
    evidence: [{
      id: "evidence-legacy-1",
      kind: "note" as const,
      title: "Library observation",
      source: "Workshop note",
      claim: "Residents need a legible cooling-centre map.",
      addedAt: NOW,
    }],
  };
  const sidecar = createEmptyPlatformSidecar();
  const storage = memoryStorage({
    [WORKSPACE_STORAGE_KEY]: serializeWorkspaceLibrary(createWorkspaceLibrary(legacy)),
    [PLATFORM_STORAGE_KEY]: serializePlatformSidecar({
      ...sidecar,
      projects: { [legacy.id]: intelligence },
    }),
  });

  const first = loadProjectRepository(storage);
  assert.equal(first.projects.length, 1);
  assert.equal(first.projects[0]?.activePhase, "evidence");
  assert.match(first.projects[0]?.summary ?? "", /evidence-bound neighbourhood/i);
  assert.ok(first.projects[0]?.artifacts.some(({ kind }) => kind === "evidence"));
  assert.ok(first.projects[0]?.nodes.some(
    ({ kind, statement }) => kind === "evidence" && /cooling-centre map/i.test(statement),
  ));
  assert.ok(storage.values.has(PROJECT_REPOSITORY_STORAGE_KEY));
  assert.ok(storage.values.has(WORKSPACE_STORAGE_KEY));
  assert.ok(storage.values.has(PLATFORM_STORAGE_KEY));

  const second = loadProjectRepository(storage);
  assert.equal(second.projects.length, 1, "a second load must not duplicate migrated projects");
  assert.equal(second.projects[0]?.id, first.projects[0]?.id);
});

test("project duplication remaps graph identity and preserves immutable review provenance", () => {
  const storage = memoryStorage({
    [WORKSPACE_STORAGE_KEY]: serializeWorkspaceLibrary(
      createWorkspaceLibrary(legacyProject()),
    ),
  });
  const migrated = loadProjectRepository(storage);
  const source = migrated.projects[0];
  assert.ok(source);
  const repository = upsertRepositoryProject(createEmptyProjectRepository(), source);
  const duplicate = duplicateRepositoryProject(
    repository,
    source.id,
    "2026-08-05T12:01:00.000Z",
  );

  assert.equal(duplicate.state.projects.length, 2);
  assert.notEqual(duplicate.project.id, source.id);
  assert.equal(duplicate.project.origin.kind, "import-clone");
  assert.equal(duplicate.project.origin.sourceProjectId, source.id);
  assert.equal(
    duplicate.project.artifacts.some(({ id }) => source.artifacts.some((item) => item.id === id)),
    false,
  );
  assert.equal(
    duplicate.project.revisions.some(({ id }) => source.revisions.some((item) => item.id === id)),
    false,
  );
});
