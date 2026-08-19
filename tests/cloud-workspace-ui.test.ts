import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  cloudProjectRelationship,
  createCloudIdempotencyKey,
  deleteCloudAccountData,
  synchronizeCloudProjects,
  uploadCloudProject,
} from "../src/lib/cloud/client-sync";
import {
  formatCloudProjectEtag,
  type CloudProjectSummary,
} from "../src/lib/cloud/contracts";
import {
  createKingxfordProject,
  stableHash,
} from "../src/lib/workspace/project-graph";

const project = createKingxfordProject({
  title: "Cloud workspace contract",
  summary: "A canonical project used to verify deliberate cloud synchronization.",
  createdAt: "2026-08-06T12:00:00.000Z",
  idSeed: "cloud-workspace-ui-test",
});

function summary(overrides: Partial<CloudProjectSummary> = {}): CloudProjectSummary {
  const version = overrides.version ?? 1;
  const contentHash = overrides.contentHash ?? stableHash(project);
  return {
    id: project.id,
    title: project.title,
    summary: project.summary,
    activePhase: project.activePhase,
    version,
    contentHash,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    etag: formatCloudProjectEtag(version, contentHash),
    ...overrides,
  };
}

test("cloud relationships distinguish current, cloud-only, and conflicting versions", () => {
  assert.equal(cloudProjectRelationship(project, null), "local-only");
  assert.equal(cloudProjectRelationship(null, summary()), "cloud-only");
  assert.equal(cloudProjectRelationship(project, summary()), "identical");

  const changedProject = {
    ...project,
    summary: "A deliberate local revision.",
    updatedAt: "2026-08-06T13:00:00.000Z",
  };
  assert.equal(cloudProjectRelationship(changedProject, summary()), "local-newer");
  assert.equal(cloudProjectRelationship(
    project,
    summary({
      contentHash: `kxhash_${"f".repeat(32)}`,
      etag: formatCloudProjectEtag(1, `kxhash_${"f".repeat(32)}`),
      updatedAt: "2026-08-06T13:00:00.000Z",
    }),
  ), "cloud-newer");
});

test("single-project uploads are explicit, idempotent, and create-only when no cloud copy exists", async () => {
  let capturedInput: RequestInfo | URL | undefined;
  let capturedInit: RequestInit | undefined;
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedInput = input;
    capturedInit = init;
    return Response.json({ ok: true, project, cloud: summary() }, { status: 201 });
  };

  const result = await uploadCloudProject(project, null, fetcher);
  assert.equal(result.project.id, project.id);
  assert.equal(capturedInput, `/api/cloud/projects/${project.id}`);
  assert.equal(capturedInit?.method, "PUT");
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("if-none-match"), "*");
  assert.equal(headers.get("if-match"), null);
  assert.match(headers.get("idempotency-key") ?? "", /^kx\.project-upload\./);
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    project,
    expectedVersion: null,
  });
});

test("updates bind the request to the exact cloud ETag and expected version", async () => {
  const remote = summary({ version: 7 });
  let capturedHeaders = new Headers();
  let capturedBody: unknown;
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedHeaders = new Headers(init?.headers);
    capturedBody = JSON.parse(String(init?.body));
    return Response.json({
      ok: true,
      project,
      cloud: summary({ version: 8 }),
    });
  };

  await uploadCloudProject(project, remote, fetcher);
  assert.equal(capturedHeaders.get("if-match"), remote.etag);
  assert.equal(capturedHeaders.get("if-none-match"), null);
  assert.equal((capturedBody as { expectedVersion: number }).expectedVersion, 7);
});

test("bulk synchronization preserves version preconditions and exposes partial conflicts", async () => {
  const second = createKingxfordProject({
    title: "Second local project",
    createdAt: "2026-08-06T12:05:00.000Z",
    idSeed: "cloud-workspace-ui-second",
  });
  const remote = summary({ version: 3 });
  let capturedBody: { projects: Array<{ expectedVersion: number | null }> } | undefined;
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body));
    return Response.json({
      ok: false,
      status: "conflicts",
      results: [
        {
          status: "updated",
          projectId: project.id,
          version: 4,
          contentHash: stableHash(project),
          replayed: false,
          updatedAt: project.updatedAt,
        },
        {
          status: "conflict",
          projectId: second.id,
          version: 2,
          contentHash: stableHash(second),
          replayed: false,
          updatedAt: second.updatedAt,
        },
      ],
    }, { status: 409 });
  };

  const result = await synchronizeCloudProjects([project, second], [remote], fetcher);
  assert.equal(result.status, "conflicts");
  assert.deepEqual(capturedBody?.projects.map(({ expectedVersion }) => expectedVersion), [3, null]);
  assert.deepEqual(result.results.map(({ status }) => status), ["updated", "conflict"]);
});

test("cloud account removal requires the server confirmation phrase and idempotency key", async () => {
  let capturedInit: RequestInit | undefined;
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedInit = init;
    return Response.json({ ok: true, status: "deleted" });
  };
  const organizationId = "11111111-1111-4111-8111-111111111111";
  await deleteCloudAccountData(organizationId, fetcher);
  assert.equal(capturedInit?.method, "DELETE");
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    confirmation: "DELETE MY CLOUD DATA",
    organizationId,
  });
  assert.equal(
    new Headers(capturedInit?.headers).get("x-kingxford-organization-id"),
    organizationId,
  );
  assert.match(new Headers(capturedInit?.headers).get("idempotency-key") ?? "", /^kx\.account-delete\./);
  assert.match(createCloudIdempotencyKey("sync", project.id), /^[A-Za-z0-9][A-Za-z0-9._:-]{7,159}$/);
});

test("cloud account deletion preserves its key across network and cleanup retries, then clears it after success", async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const keys: string[] = [];
  let attempt = 0;
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    keys.push(new Headers(init?.headers).get("idempotency-key") ?? "");
    attempt += 1;
    if (attempt === 1) {
      throw new TypeError("Network connection interrupted.");
    }
    if (attempt === 2) {
      return Response.json({
        error: {
          code: "evidence_cleanup_pending",
          message: "Private evidence cleanup is still pending.",
        },
      }, { status: 503 });
    }
    return Response.json({ ok: true, status: "deleted" });
  };
  const organizationId = "22222222-2222-4222-8222-222222222222";

  await assert.rejects(
    deleteCloudAccountData(organizationId, fetcher, storage),
    /Network connection interrupted\./,
  );
  assert.equal(values.size, 1);

  await assert.rejects(
    deleteCloudAccountData(organizationId, fetcher, storage),
    (error: unknown) => error instanceof Error
      && error.message === "Private evidence cleanup is still pending.",
  );
  assert.equal(keys[1], keys[0]);
  assert.equal(values.size, 1);

  await deleteCloudAccountData(organizationId, fetcher, storage);
  assert.equal(keys[2], keys[1]);
  assert.equal(values.size, 0);

  await deleteCloudAccountData(organizationId, fetcher, storage);
  assert.notEqual(keys[3], keys[2]);
  assert.equal(values.size, 0);
});

test("the account data controls delegate deletion to the retry-safe cloud helper", async () => {
  const source = await readFile(
    new URL("../src/app/account/AccountDataControls.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /import \{ deleteCloudAccountData \} from "@\/lib\/cloud\/client-sync";/);
  assert.match(source, /await deleteCloudAccountData\(account\.record\.organization\.id\);/);
  assert.doesNotMatch(source, /Idempotency-Key|crypto\.randomUUID|method: "DELETE"/);
});

test("the cloud panel states its local-first and no-overwrite contract in the interface", async () => {
  const source = await readFile(
    new URL("../src/components/workspace/CloudProjectPanel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Nothing uploads until you choose a cloud action\./);
  assert.match(source, /nothing was overwritten/i);
  assert.match(source, /Review version/);
  assert.match(source, /DELETE MY CLOUD DATA/);
  assert.doesNotMatch(source, /setInterval\(|visibilitychange|beforeunload/);
});

test("the Canvas workspace keeps consequential decisions in the interface, not browser prompts", async () => {
  const source = await readFile(
    new URL("../src/components/workspace/CreativeWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /window\.(?:prompt|confirm)\(/);
  assert.match(source, /aria-labelledby="gate-approval-title"/);
  assert.match(source, /Only you can record this decision\./);
  assert.match(source, /disabled=\{!gateReviewed \|\| !gateRationaleReady \|\| projectMutationLocked\}/);
});

test("workspace shortcuts stay inside the workspace root and never bind for the embedded instance", async () => {
  const source = await readFile(
    new URL("../src/components/workspace/CreativeWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /window\.addEventListener\("keydown"/);
  assert.match(source, /if \(embedded \|\| !root\) return;/);
  assert.match(source, /root\.addEventListener\("keydown", handleShortcut\)/);
  assert.match(source, /root\.removeEventListener\("keydown", handleShortcut\)/);
});

test("version history is project scoped, and a preview run does not consume a version slot", async () => {
  const source = await readFile(
    new URL("../src/components/workspace/CreativeWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /workspaceVersionsForProject\(versions, activeProject\.id\)/);
  assert.match(source, /versions=\{projectVersions\}/);
  assert.match(
    source,
    /if \(!activeProject \|\| version\.projectId !== activeProject\.id\) \{\s*setStatus\("Restore blocked/,
  );
  const runPreview = source.slice(
    source.indexOf("const runPreview = useCallback("),
    source.indexOf("const runPreview = useCallback(") + 400,
  );
  assert.doesNotMatch(runPreview, /saveVersion\(/);
});

test("a blocked readiness check can be retried without reloading the workspace", async () => {
  const source = await readFile(
    new URL("../src/components/workspace/CreativeWorkspace.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /onClick=\{checkAiReadiness\}/);
  assert.match(source, /document\.addEventListener\("visibilitychange", recheckWhenVisible\)/);
  assert.match(source, /window\.addEventListener\("online", checkAiReadiness\)/);
  assert.match(
    source,
    /reviewAvailability\.state === "blocked" \? \(\s*<button\s+className=\{styles\.readinessRetry\}/,
  );
});

test("creating a project collects its details instead of making an unnamed one", async () => {
  const workspace = await readFile(
    new URL("../src/components/workspace/CreativeWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const dialog = await readFile(
    new URL("../src/components/workspace/NewProjectDialog.tsx", import.meta.url),
    "utf8",
  );

  // Every "New project" affordance opens the dialog; none creates silently.
  assert.match(workspace, /onClick=\{openNewProject\}/);
  assert.match(
    workspace,
    /onCreate=\{\(\) => \{\s*setProjectLibraryOpen\(false\);\s*openNewProject\(\);\s*\}\}/,
  );
  assert.doesNotMatch(workspace, /onClick=\{createLocalProject\}/);
  assert.doesNotMatch(workspace, /createLocalProject\(\);/);
  assert.doesNotMatch(workspace, /"New Kingxford project"/);

  // The collected details reach the created project rather than a fixed title.
  assert.match(workspace, /const createLocalProject = \(details: NewProjectDetails\) =>/);
  assert.match(workspace, /createWorkflowProject\(templateId, \{\s*title: details\.title,/);
  // A user-named project must not inherit the sample project's content.
  assert.match(workspace, /\{ idea: objective, mindmap: "", prompt: "", brief: "" \}/);
  assert.match(workspace, /\{ html: "", css: "", javascript: "" \},\s*details\.startingPoint\.mode,/);
  // The objective survives the first commit, which rewrites summary from the
  // idea artifact, so a workflow project carries it in both places.
  // A guided project keeps the objective it was given: its discovery artifact
  // holds the template's authored brief, so summary must not track that text.
  assert.match(workspace, /function summaryForDraft\(/);
  assert.match(
    workspace,
    /if \(mode !== "idea" \|\| workflowTemplateForProject\(project\)\) \{\s*return project\.summary;/,
  );
  // All three derivation sites go through the shared rule. The fallback that
  // mints a project when none is active still derives it, which is correct:
  // a project created there has no template.
  assert.match(workspace, /summary: summaryForDraft\(base, nextDraft\.mode, nextDraft\.text\)/);
  assert.match(workspace, /summary: summaryForDraft\(activeProject, mode, currentText\)/);
  assert.match(workspace, /const nextSummary = summaryForDraft\(activeProject, mode, currentText\)/);
  // The template's own artifacts survive creation untouched.
  assert.doesNotMatch(workspace, /project = appendDraftToProject\(project, \{\s*mode: "idea",/);
  assert.match(workspace, /setStatus\(\s*details\.startingPoint\.kind === "workflow"/);

  // A fresh form on every opening, without resetting state from an effect.
  assert.match(workspace, /key=\{newProjectSession\}/);
  assert.match(workspace, /setNewProjectSession\(\(session\) => session \+ 1\)/);

  // Both answers are required, so a project is never created unidentifiable.
  assert.match(dialog, /if \(!trimmedTitle\) \{[\s\S]*?setError\(/);
  assert.match(dialog, /if \(!trimmedObjective\) \{[\s\S]*?setError\(/);
  // Escape, backdrop, and the close control all route through one handler.
  assert.match(dialog, /onCancel=\{\(event\) => \{\s*event\.preventDefault\(\);\s*onClose\(\);/);
  assert.match(
    dialog,
    /if \(event\.target === event\.currentTarget && !pointerDownInside\.current\) \{/,
  );
  // The starting-point control is not described as tabs it does not have.
  assert.doesNotMatch(dialog, /role="tab"/);
  assert.match(dialog, /aria-pressed=\{origin === "blank"\}/);
  // required is for assistive technology; validation reports through one
  // styled message, so native constraint UI must not preempt the handler.
  assert.match(dialog, /noValidate/);
  assert.match(dialog, /aria-invalid=\{error\?\.field === "objective" \? true : undefined\}/);
  // Selecting the guided tab applies the highlighted template, so the form is
  // never submitted looking filled while empty.
  assert.match(dialog, /onClick=\{\(\) => chooseTemplate\(templateId\)\}/);
  // A drag-select that ends over the backdrop must not discard the form.
  assert.match(dialog, /pointerDownInside\.current = event\.target !== event\.currentTarget/);
  // Arrow keys move within each radiogroup the roles claim.
  assert.match(dialog, /const moveWithinGroup = \(/);
  assert.match(dialog, /tabIndex=\{mode === start\.mode \? 0 : -1\}/);
  // A creation failure is reported inside the modal, not behind its backdrop.
  assert.match(dialog, /\{error\?\.message \|\| submitError\}/);
  // Choosing another template refreshes only the field nobody has written in.
  assert.match(dialog, /if \(!titleTouched\) setTitle\(template\.projectTitle\);/);
  assert.match(dialog, /if \(!objectiveTouched\) setObjective\(template\.projectSummary\);/);
  // Focus is claimed a frame after opening, outside the showModal branch, so a
  // second effect pass still lands it on the name field.
  assert.match(dialog, /const frame = window\.requestAnimationFrame\(\(\) => titleRef\.current\?\.focus\(\)\);/);
});
