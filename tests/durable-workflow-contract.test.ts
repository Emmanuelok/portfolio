import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { GET as getHealth } from "../src/app/api/health/route";
import {
  GET as getDurableRun,
  POST as startDurableRun,
} from "../src/app/api/intelligence/workflows/route";
import { durableIntelligenceOutcomeSchema } from "../src/workflows/intelligence-review";

test("durable outcome contract keeps operational failures bounded and proposal-only", () => {
  const outcome = durableIntelligenceOutcomeSchema.parse({
    ok: false,
    error: {
      code: "usage-service-unavailable",
      message:
        "Distributed usage accounting is unavailable. No content was sent.",
      retryAfter: 15,
    },
  });

  assert.equal(outcome.ok, false);
  assert.equal(JSON.stringify(outcome).includes("projectGraphSnapshot"), false);
});

test("durable review routes fail safely when cloud identity is unavailable", async () => {
  const getResponse = await getDurableRun(
    new Request("http://localhost/api/intelligence/workflows?runId=run_test_123456"),
  );
  assert.equal(getResponse.status, 503);

  const postResponse = await startDurableRun(
    new Request("http://localhost/api/intelligence/workflows", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  assert.equal(postResponse.status, 403, "origin checks run before session work");
});

test("public health reports capability readiness without exposing configuration values", async () => {
  const response = await getHealth();
  const body = (await response.json()) as Record<string, unknown>;
  const serialized = JSON.stringify(body);

  assert.equal(response.status, 200);
  assert.equal(body.service, "kingxford-platform");
  assert.equal(serialized.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.equal(serialized.includes("KINGXFORD_USAGE_HASH_SALT"), false);
  assert.equal(serialized.includes("RESEND_API_KEY"), false);
});

test("durable run registry mutations use the server-only persistence client", async () => {
  const route = await readFile(
    new URL("../src/app/api/intelligence/workflows/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /const serviceClient = createServiceCloudClient\(\)/);
  assert.match(route, /const \{ data, error \} = await serviceClient[\s\S]*?\.from\("intelligence_runs"\)[\s\S]*?\.insert\(/);
  assert.doesNotMatch(route, /context\.client[\s\S]{0,120}\.from\("intelligence_runs"\)[\s\S]{0,120}\.insert\(/);
});
