import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  cloudProjectContentHash,
  formatCloudProjectEtag,
  matchesIfMatch,
  parseCloudProjectEtag,
  parseCloudProjectWrite,
  parseCloudSyncWrite,
  parseIdempotencyKey,
  requestFingerprint,
} from "../src/lib/cloud/contracts";
import { readCloudProjectListEntry } from "../src/lib/cloud/repository";
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

test("an unreadable cloud row stays listable and carries the ETag needed to delete it", () => {
  const contentHash = cloudProjectContentHash(project);
  const row = {
    id: project.id,
    title: project.title,
    summary: project.summary,
    active_phase: project.activePhase,
    document: project,
    version: 3,
    content_hash: contentHash,
    created_at: "2026-08-06T12:00:00.000Z",
    updated_at: "2026-08-06T12:30:00.000Z",
  };

  const healthy = readCloudProjectListEntry(row);
  if (!healthy.readable) throw new Error("A valid row must stay fully typed.");
  assert.equal(healthy.id, project.id);
  assert.equal(healthy.etag, formatCloudProjectEtag(3, contentHash));

  const unparsable = readCloudProjectListEntry({ ...row, document: { broken: true } });
  if (unparsable.readable) throw new Error("A corrupt document must not be reported as readable.");
  assert.equal(unparsable.reason, "unreadable_document");
  assert.equal(unparsable.id, project.id);
  assert.equal(unparsable.updatedAt, row.updated_at);
  assert.equal(unparsable.etag, formatCloudProjectEtag(3, contentHash));

  const mismatched = readCloudProjectListEntry({ ...row, title: "Renamed outside the contract" });
  if (mismatched.readable) throw new Error("An integrity mismatch must not be reported as readable.");
  assert.equal(mismatched.reason, "integrity_mismatch");
  assert.equal(mismatched.etag, formatCloudProjectEtag(3, contentHash));

  const invalid = readCloudProjectListEntry({ ...row, version: 0 });
  if (invalid.readable) throw new Error("An invalid record must not be reported as readable.");
  assert.equal(invalid.reason, "invalid_record");
  assert.equal(invalid.version, null);
  assert.equal(invalid.etag, null);
  assert.equal(invalid.id, project.id);

  const listing = [row, { ...row, document: null }].map(readCloudProjectListEntry);
  assert.deepEqual(listing.map((entry) => entry.readable), [true, false]);
});

test("retention purges are bounded, repeatable, and reserved for scheduled service-role work", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/202608060005_retention_and_attribution.sql", import.meta.url),
    "utf8",
  );
  const purges = [
    "purge_kingxford_idempotency_keys",
    "purge_kingxford_deletion_receipts",
    "purge_kingxford_audit_events",
    "purge_kingxford_usage_records",
    "purge_kingxford_project_revisions",
    "purge_kingxford_intelligence_runs",
  ];
  for (const purge of purges) {
    assert.match(migration, new RegExp(`create or replace function public\\.${purge}`, "i"));
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${purge}\\(interval, integer\\) to service_role`, "i"),
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`grant execute on function public\\.${purge}[^;]*to authenticated`, "i"),
    );
  }
  assert.match(migration, /v_limit integer := least\(greatest\(coalesce\(p_limit, 1000\), 1\), 5000\)/i);
  assert.match(migration, /newer\.project_version > expired\.project_version/i);
  assert.match(migration, /expired\.status in \('completed', 'failed', 'cancelled'\)/i);
  assert.match(migration, /create index if not exists usage_records_user_idx/i);
  assert.match(migration, /create index if not exists audit_events_actor_idx/i);
  assert.doesNotMatch(migration, /cron\.schedule/i);
  assert.doesNotMatch(migration, /create policy/i);
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
