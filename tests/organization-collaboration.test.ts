import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createOrganizationInvitationToken,
  hashOrganizationInvitationToken,
  invitationAcceptSchema,
  invitationCreateSchema,
  memberRoleUpdateSchema,
} from "../src/lib/cloud/organization-contracts";
import {
  getActiveCloudOrganization,
  setActiveCloudOrganization,
  withActiveCloudOrganization,
} from "../src/lib/cloud/organization-selection";

const migrationUrl = new URL(
  "../supabase/migrations/202608060003_organization_collaboration.sql",
  import.meta.url,
);

test("invitation secrets are high-entropy, validated, and stored as SHA-256 digests", () => {
  const first = createOrganizationInvitationToken();
  const second = createOrganizationInvitationToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.equal(invitationAcceptSchema.parse({ token: first }).token, first);
  assert.throws(() => invitationAcceptSchema.parse({ token: "too-short" }));

  const digest = hashOrganizationInvitationToken(first);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(digest, createHash("sha256").update(first, "utf8").digest("hex"));
  assert.notEqual(digest, first);
});

test("invitations normalize email and exclude administrative and owner roles", () => {
  assert.deepEqual(invitationCreateSchema.parse({
    email: "  Member@Example.COM ",
    role: "reviewer",
    expiresInHours: 24,
  }), {
    email: "member@example.com",
    role: "reviewer",
    expiresInHours: 24,
  });
  for (const role of ["owner", "admin"]) {
    assert.throws(() => invitationCreateSchema.parse({
      email: "member@example.com",
      role,
      expiresInHours: 24,
    }));
  }
  assert.throws(() => invitationCreateSchema.parse({
    email: "member@example.com",
    role: "viewer",
    expiresInHours: 169,
  }));
  assert.equal(memberRoleUpdateSchema.parse({ role: "owner" }).role, "owner");
});

test("the selected organization is validated before entering shared cloud headers", () => {
  const values = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      dispatchEvent: () => true,
    },
  });
  try {
    const organizationId = "11111111-1111-4111-8111-111111111111";
    setActiveCloudOrganization(organizationId);
    assert.equal(getActiveCloudOrganization(), organizationId);
    assert.equal(
      withActiveCloudOrganization().get("x-kingxford-organization-id"),
      organizationId,
    );
    values.set("kingxford.cloud.active-organization.v1", "not-an-organization");
    assert.equal(getActiveCloudOrganization(), null);
    assert.equal(withActiveCloudOrganization().has("x-kingxford-organization-id"), false);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("database collaboration functions enforce expiry, single use, email match, RBAC, and owner safeguards", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /create table if not exists public\.organization_invitations/i);
  assert.match(migration, /token_hash text not null unique[^;]*\^\[0-9a-f\]\{64\}\$/i);
  assert.doesNotMatch(migration, /\btoken\s+text\b/i);
  assert.match(migration, /expires_at <= created_at \+ interval '7 days'/i);
  assert.match(migration, /p_role not in \('editor', 'reviewer', 'viewer'\)/i);
  assert.match(migration, /v_invitation\.email <> v_user_email/i);
  assert.match(migration, /v_invitation\.accepted_at is not null[^]*already been used/i);
  assert.match(migration, /v_invitation\.revoked_at is not null[^]*has been revoked/i);
  assert.match(migration, /v_invitation\.expires_at <= v_now[^]*has expired/i);
  assert.match(migration, /v_actor_role = 'admin'[^]*v_target_role = 'owner'/i);
  assert.match(migration, /p_target_user_id = v_user_id/i);
  assert.match(migration, /v_owner_count <= 1[^]*sole organization owner/i);
  assert.match(migration, /organization\.owner_user_id = p_target_user_id/i);
  assert.match(migration, /organization\.invitation\.created/i);
  assert.match(migration, /organization\.member\.role_updated/i);
  assert.match(migration, /revoke all on public\.organization_invitations from authenticated/i);
});

test("invitation links keep raw tokens out of request URLs and operational logs", async () => {
  const [route, client] = await Promise.all([
    readFile(new URL(
      "../src/app/api/cloud/organization/invitations/route.ts",
      import.meta.url,
    ), "utf8"),
    readFile(new URL(
      "../src/app/accept-invitation/AcceptInvitationClient.tsx",
      import.meta.url,
    ), "utf8"),
  ]);
  assert.match(route, /accept-invitation#token=\$\{token\}/);
  assert.doesNotMatch(route, /accept-invitation\?token=/);
  assert.doesNotMatch(route, /console\.(?:log|info|warn|error)[^;]*token/i);
  assert.match(client, /history\.replaceState\(null, "", "\/accept-invitation"\)/);
  assert.match(client, /tokenLifetimeMs = 30 \* 60 \* 1_000/);
});

test("account deletion is organization-pinned, replayable, and cleans storage after the database receipt", async () => {
  const [route, migration] = await Promise.all([
    readFile(new URL("../src/app/api/cloud/account/route.ts", import.meta.url), "utf8"),
    readFile(migrationUrl, "utf8"),
  ]);
  const deleteRoute = route.slice(route.indexOf("export async function DELETE"));
  assert.match(deleteRoute, /x-kingxford-organization-id[^]*!== organizationId/i);
  assert.match(deleteRoute, /replay_kingxford_cloud_data_deletion/i);
  assert.ok(
    deleteRoute.indexOf("replay_kingxford_cloud_data_deletion")
      < deleteRoute.indexOf("const context = await requireCloudContext(request)"),
  );
  assert.ok(
    deleteRoute.indexOf('rpc("delete_my_kingxford_cloud_data"')
      < deleteRoute.indexOf("completeEvidenceCleanup(data)"),
  );
  assert.match(migration, /create table if not exists public\.cloud_account_deletion_receipts/i);
  assert.match(migration, /storagePaths', v_storage_paths/i);
  assert.match(migration, /primary key \(user_id, idempotency_key\)/i);
  const receiptDefinition = migration.slice(
    migration.indexOf("create table if not exists public.cloud_account_deletion_receipts"),
    migration.indexOf("create index if not exists cloud_account_deletion_receipts_expiry_idx"),
  );
  assert.doesNotMatch(receiptDefinition, /organization_id[^,]*references public\.organizations/i);
});
