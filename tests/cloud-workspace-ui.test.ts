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
