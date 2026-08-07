import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatCloudProjectEtag,
  matchesIfMatch,
  parseCloudProjectEtag,
  parseCloudProjectWrite,
  parseCloudSyncWrite,
  parseIdempotencyKey,
  requestFingerprint,
} from "../src/lib/cloud/contracts";
import { requireCloudMutationRequest } from "../src/lib/cloud/request-security";
import { getCloudAvailability, getCloudConfiguration } from "../src/lib/cloud/config";
import { safeCloudReturnPath } from "../src/lib/cloud/navigation";
import { createKingxfordProject } from "../src/lib/workspace/project-graph";

const project = createKingxfordProject({
  title: "Cloud foundation",
  summary: "A strictly validated project.",
  idSeed: "cloud-foundation-test",
  createdAt: "2026-08-06T12:00:00.000Z",
});

test("cloud configuration is optional, honest, and build-safe", () => {
  assert.equal(getCloudConfiguration({}), null);
  assert.equal(getCloudConfiguration({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  }), null);
  assert.equal(getCloudConfiguration({
    NEXT_PUBLIC_SUPABASE_URL: "javascript:alert(1)",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  }), null);

  assert.deepEqual(getCloudConfiguration({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  }), {
    url: "https://project.supabase.co",
    publishableKey: "publishable-key",
  });
  assert.deepEqual(getCloudAvailability({}).mode, "local-only");
  assert.match(getCloudAvailability({}).message, /Local Canvas and Atlas/i);
});

test("cloud writes reuse the strict Kingxford project validator", () => {
  const parsed = parseCloudProjectWrite({ project, expectedVersion: 4 });
  assert.equal(parsed.project.id, project.id);
  assert.equal(parsed.expectedVersion, 4);

  assert.throws(
    () => parseCloudProjectWrite({
      project: { ...project, unexpected: true },
      expectedVersion: 4,
    }),
    /unrecognized|unrecognized key|expected|invalid/i,
  );
  assert.throws(
    () => parseCloudProjectWrite({ project, unexpected: true }),
    /unrecognized|unrecognized key/i,
  );
});

test("ETags bind cloud updates to a version and exact content hash", () => {
  const hash = requestFingerprint(project);
  const etag = formatCloudProjectEtag(7, hash);
  assert.deepEqual(parseCloudProjectEtag(etag), { version: 7, contentHash: hash });
  assert.equal(matchesIfMatch(etag, etag), true);
  assert.equal(matchesIfMatch(`"another", ${etag}`, etag), true);
  assert.equal(matchesIfMatch("*", etag), true);
  assert.equal(parseCloudProjectEtag("W/\"kxcloud-v7-kxhash_bad\""), null);
  assert.equal(parseCloudProjectEtag("*"), null);
});

test("mutation idempotency keys are bounded and reusable fingerprints are stable", () => {
  assert.equal(parseIdempotencyKey("project-save:01"), "project-save:01");
  assert.throws(() => parseIdempotencyKey("short"), /Idempotency-Key/);
  assert.throws(() => parseIdempotencyKey("spaces are unsafe"), /Idempotency-Key/);
  assert.equal(requestFingerprint({ project, version: 1 }), requestFingerprint({ version: 1, project }));
});

test("sync envelopes reject duplicate projects before cloud writes begin", () => {
  assert.throws(
    () => parseCloudSyncWrite({
      projects: [
        { project, expectedVersion: null },
        { project, expectedVersion: null },
      ],
    }),
    /same project more than once/i,
  );
  assert.equal(parseCloudSyncWrite({
    projects: [{ project, expectedVersion: null }],
  }).projects.length, 1);
});

test("authentication redirects accept only same-origin paths", () => {
  assert.equal(safeCloudReturnPath("/create/workspace?mode=brief"), "/create/workspace?mode=brief");
  assert.equal(safeCloudReturnPath("https://example.com"), "/create/workspace");
  assert.equal(safeCloudReturnPath("//example.com"), "/create/workspace");
});

test("the database migration enables tenant RLS and private evidence storage", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/202608060001_cloud_foundation.sql", import.meta.url),
    "utf8",
  );
  const protectedTables = [
    "organizations",
    "organization_members",
    "projects",
    "project_revisions",
    "intelligence_runs",
    "audit_events",
    "usage_records",
    "evidence_objects",
    "idempotency_keys",
  ];
  for (const table of protectedTables) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }
  assert.match(migration, /'kingxford-private', 'kingxford-private', false/i);
  assert.match(migration, /drop policy if exists kingxford_private_select/i);
  assert.doesNotMatch(migration, /create policy kingxford_private_select/i);
  assert.doesNotMatch(migration, /create policy kingxford_private_insert/i);
  assert.match(migration, /grant select on public\.project_revisions/i);
  assert.doesNotMatch(migration, /grant select, insert on public\.project_revisions/i);
  assert.match(migration, /grant select on public\.audit_events/i);
  assert.doesNotMatch(migration, /grant select, insert on public\.audit_events/i);
  assert.match(migration, /grant select on public\.intelligence_runs/i);
  assert.doesNotMatch(migration, /grant select, insert on public\.intelligence_runs/i);
  assert.match(migration, /grant select on public\.usage_records/i);
  assert.doesNotMatch(migration, /grant select, insert on public\.usage_records/i);
  assert.match(migration, /create or replace function public\.upsert_kingxford_project/i);
  assert.match(migration, /p_expected_content_hash text/i);
  assert.match(migration, /unique index if not exists usage_records_run_feature_idx\s+on public\.usage_records\(run_id, feature\)/i);
});

test("server-owned records remain read-only to authenticated browser sessions", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/202608060004_server_owned_records.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /revoke insert, update on public\.intelligence_runs from authenticated/i);
  assert.match(migration, /revoke insert on public\.audit_events from authenticated/i);
  assert.match(migration, /revoke insert on public\.usage_records from authenticated/i);
  assert.match(migration, /revoke usage, select on sequence public\.usage_records_id_seq from authenticated/i);
});

test("cookie-authenticated cloud mutations require same-origin JSON where applicable", () => {
  assert.throws(
    () =>
      requireCloudMutationRequest(
        new Request("https://kingxford.co/api/cloud/projects/sync", {
          method: "POST",
          headers: { "content-type": "application/json" },
        }),
      ),
    /only from the Kingxford site/i,
  );
  assert.throws(
    () =>
      requireCloudMutationRequest(
        new Request("https://kingxford.co/api/cloud/projects/sync", {
          method: "POST",
          headers: {
            origin: "https://example.net",
            host: "kingxford.co",
            "content-type": "application/json",
          },
        }),
      ),
    /only from the Kingxford site/i,
  );
  assert.doesNotThrow(() =>
    requireCloudMutationRequest(
      new Request("https://kingxford.co/api/cloud/projects/sync", {
        method: "POST",
        headers: {
          origin: "https://kingxford.co",
          host: "kingxford.co",
          "sec-fetch-site": "same-origin",
          "content-type": "application/json; charset=utf-8",
        },
      }),
      { json: true },
    ),
  );
});
