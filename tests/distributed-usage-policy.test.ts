import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  beginWorkspaceRequest,
  consumeWorkspaceCredits,
  finishWorkspaceRequest,
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
