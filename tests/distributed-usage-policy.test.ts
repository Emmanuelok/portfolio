import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  beginWorkspaceRequest,
  consumeWorkspaceCredits,
  finishWorkspaceRequest,
  getWorkspaceUsage,
  releaseWorkspaceCredits,
  trustsForwardedClientAddress,
  workspaceGlobalUsagePolicy,
  workspaceUsageBackend,
  workspaceUsagePolicy,
} from "../src/lib/workspace/usage-policy";

test("production usage readiness requires a complete distributed store configuration", () => {
  assert.deepEqual(
    workspaceUsageBackend({ NODE_ENV: "production" }),
    {
      kind: "missing",
      configured: false,
      durable: false,
      ready: false,
    },
  );

  assert.deepEqual(
    workspaceUsageBackend({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "configured-server-token",
    }),
    {
      kind: "upstash-redis",
      configured: true,
      durable: true,
      ready: true,
    },
  );

  assert.equal(
    workspaceUsageBackend({
      NODE_ENV: "production",
      UPSTASH_REDIS_REST_URL: "https://partial.example",
    }).ready,
    false,
  );

  assert.deepEqual(
    workspaceUsageBackend({
      NODE_ENV: "production",
      KINGXFORD_ALLOW_EPHEMERAL_USAGE: "1",
    }),
    {
      kind: "process-memory",
      configured: false,
      durable: false,
      ready: true,
    },
  );
  assert.equal(
    workspaceUsageBackend({
      NODE_ENV: "production",
      VERCEL: "1",
      KINGXFORD_ALLOW_EPHEMERAL_USAGE: "1",
    }).ready,
    false,
    "the local verification escape hatch is ignored on Vercel",
  );
});

test("local admission preserves concurrency and credit ceilings", async () => {
  const key = `test-${randomUUID()}`;
  const first = await beginWorkspaceRequest(key);
  const second = await beginWorkspaceRequest(key);
  const blocked = await beginWorkspaceRequest(key);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.reason, "concurrency");

  if (first.allowed) {
    await finishWorkspaceRequest(first.usageKey, first.leaseId);
  }
  const admittedAfterRelease = await beginWorkspaceRequest(key);
  assert.equal(admittedAfterRelease.allowed, true);

  const credits = await consumeWorkspaceCredits(key, "deep", 4);
  assert.equal(credits.allowed, true);
  assert.equal(
    credits.usage.creditCost,
    workspaceUsagePolicy.creditCost.deep * 4,
  );

  if (second.allowed) {
    await finishWorkspaceRequest(second.usageKey, second.leaseId);
  }
  if (admittedAfterRelease.allowed) {
    await finishWorkspaceRequest(
      admittedAfterRelease.usageKey,
      admittedAfterRelease.leaseId,
    );
  }
});

test("forwarded visitor addresses are trusted only behind a reviewed proxy", () => {
  assert.equal(
    trustsForwardedClientAddress({ NODE_ENV: "production", VERCEL: "1" }),
    true,
  );
  assert.equal(
    trustsForwardedClientAddress({
      NODE_ENV: "production",
      KINGXFORD_TRUSTED_FORWARDED_PROXY: "1",
    }),
    true,
  );
  assert.equal(trustsForwardedClientAddress({ NODE_ENV: "production" }), false);
});

test("a credit refund releases one reservation exactly once", async () => {
  const key = `refund-${randomUUID()}`;
  const cost = workspaceUsagePolicy.creditCost.deep;
  const charged = await consumeWorkspaceCredits(key, "deep");

  assert.equal(charged.allowed, true);
  assert.equal(
    (await getWorkspaceUsage(key, "deep")).dailyCreditsRemaining,
    workspaceUsagePolicy.dailyCredits - cost,
  );

  assert.equal(await releaseWorkspaceCredits(key, charged.reservationId), cost);
  assert.equal(await releaseWorkspaceCredits(key, charged.reservationId), 0);
  assert.equal(await releaseWorkspaceCredits(key, randomUUID()), 0);
  assert.equal(
    (await getWorkspaceUsage(key, "deep")).dailyCreditsRemaining,
    workspaceUsagePolicy.dailyCredits,
    "repeated refunds cannot raise a counter above its ceiling",
  );
});

test("the deployment-wide ceiling degrades new visitors without charging them", async () => {
  const deepCost = workspaceUsagePolicy.creditCost.deep;
  const chargesPerVisitor = Math.floor(
    workspaceUsagePolicy.dailyCredits / deepCost,
  );
  const visitorBudget = chargesPerVisitor * deepCost;
  const visitors =
    Math.ceil(workspaceGlobalUsagePolicy.dailyCredits / visitorBudget) + 1;

  let exhausted = false;
  for (let visitor = 0; visitor < visitors && !exhausted; visitor += 1) {
    const key = `global-${randomUUID()}`;
    for (let charge = 0; charge < chargesPerVisitor; charge += 1) {
      const result = await consumeWorkspaceCredits(key, "deep");
      if (!result.allowed && result.reason === "global") {
        exhausted = true;
        break;
      }
      assert.equal(result.allowed, true);
    }
  }
  assert.equal(exhausted, true);

  const key = `global-${randomUUID()}`;
  const blocked = await consumeWorkspaceCredits(key, "deep");
  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.reason, "global");
  assert.equal(
    (await getWorkspaceUsage(key, "deep")).dailyCreditsRemaining,
    workspaceUsagePolicy.dailyCredits,
    "a visitor is not charged for a run the global ceiling refused",
  );
});
