import assert from "node:assert/strict";
import test from "node:test";

import { GET as getIntelligenceDiagnostic } from "../src/app/api/intelligence/runs/route";
import { GET as getWorkspaceDiagnostic } from "../src/app/api/workspace/agent/route";
import {
  AI_READINESS_CONTRACT_VERSION,
  aiReadinessSchema,
  buildAiReadiness,
  gatewayAuthMethod,
  hasGatewayAuth,
} from "../src/lib/intelligence/readiness";

const routes = {
  standard: {
    model: "openai/gpt-5.6-terra",
    fallbackModels: ["openai/gpt-5.6-luna", "openai/gpt-5.4-mini"],
    reasoning: "medium" as const,
    maxOutputTokens: 3_200,
  },
  deep: {
    model: "openai/gpt-5.6-sol",
    fallbackModels: ["openai/gpt-5.4", "openai/gpt-5.6-terra"],
    reasoning: "xhigh" as const,
    maxOutputTokens: 5_200,
  },
};

const governance = {
  toolsEnabled: false as const,
  automaticApplyEnabled: false as const,
  gateApprovalMode: "human-only" as const,
};

test("readiness separates a valid API implementation from missing production configuration", () => {
  const readiness = buildAiReadiness({
    routes,
    usageProtectionReady: false,
    ...governance,
    environment: { NODE_ENV: "production" },
  });

  assert.equal(readiness.contractVersion, AI_READINESS_CONTRACT_VERSION);
  assert.equal(readiness.codeReady, true);
  assert.equal(readiness.deploymentReady, false);
  assert.equal(readiness.providerReady, false);
  assert.equal(readiness.usageProtectionReady, false);
  assert.equal(readiness.localFallbackReady, false);
  assert.equal(readiness.status, "deployment-blocked");
  assert.deepEqual(
    readiness.blockers.map(({ code }) => code),
    ["gateway-auth-missing", "usage-protection-missing"],
  );
  assert.equal(readiness.provider.liveConnectionVerified, false);
  assert.equal(readiness.provider.modelCatalogVerifiedAtRequest, false);
  assert.deepEqual(aiReadinessSchema.parse(readiness), readiness);
});

test("readiness recognizes API-key and OIDC auth without exposing values", () => {
  const apiKeyReadiness = buildAiReadiness({
    routes,
    usageProtectionReady: true,
    ...governance,
    environment: {
      NODE_ENV: "production",
      AI_GATEWAY_API_KEY: "private-gateway-value",
      VERCEL_OIDC_TOKEN: "private-oidc-value",
      KINGXFORD_USAGE_HASH_SALT: "s".repeat(32),
    },
  });
  const serialized = JSON.stringify(apiKeyReadiness);

  assert.equal(apiKeyReadiness.codeReady, true);
  assert.equal(apiKeyReadiness.deploymentReady, true);
  assert.equal(apiKeyReadiness.providerReady, true);
  assert.equal(apiKeyReadiness.usageProtectionReady, true);
  assert.equal(apiKeyReadiness.status, "ready");
  assert.equal(apiKeyReadiness.provider.authMethod, "gateway-api-key");
  assert.equal(apiKeyReadiness.usageProtection.source, "configured-secret");
  assert.equal(serialized.includes("private-gateway-value"), false);
  assert.equal(serialized.includes("private-oidc-value"), false);
  assert.equal(serialized.includes("s".repeat(32)), false);

  assert.equal(
    gatewayAuthMethod({ VERCEL_OIDC_TOKEN: "oidc-only" }),
    "vercel-oidc",
  );
  assert.equal(
    gatewayAuthMethod({ VERCEL: "1" }),
    "vercel-oidc",
    "Vercel deployments use request-scoped OIDC without a manually configured key",
  );
  assert.equal(hasGatewayAuth({ AI_GATEWAY_API_KEY: "   " }), false);
  assert.equal(
    gatewayAuthMethod({ AI_GATEWAY_API_KEY: "   ", VERCEL: "1" }),
    "gateway-api-key",
    "a non-empty API key retains the SDK's precedence even when malformed",
  );
  assert.equal(
    hasGatewayAuth({ AI_GATEWAY_API_KEY: "   ", VERCEL: "1" }),
    false,
  );
});

test("readiness reports an honest local fallback when provider auth is absent", () => {
  const readiness = buildAiReadiness({
    routes,
    usageProtectionReady: true,
    ...governance,
    environment: { NODE_ENV: "development" },
  });

  assert.equal(readiness.codeReady, true);
  assert.equal(readiness.deploymentReady, false);
  assert.equal(readiness.providerReady, false);
  assert.equal(readiness.localFallbackReady, true);
  assert.equal(readiness.status, "local-fallback");
  assert.equal(readiness.usageProtection.source, "development-fallback");
  assert.deepEqual(
    readiness.blockers.map(({ code }) => code),
    ["gateway-auth-missing"],
  );
});

test("readiness reports invalid routing or governance without throwing the diagnostic", () => {
  const readiness = buildAiReadiness({
    routes: {
      ...routes,
      deep: {
        ...routes.deep,
        fallbackModels: [
          routes.deep.model,
          "openai/gpt-5.4",
          "openai/gpt-5.4-mini",
        ],
      },
    },
    usageProtectionReady: true,
    toolsEnabled: true,
    automaticApplyEnabled: true,
    gateApprovalMode: "automatic",
    environment: { AI_GATEWAY_API_KEY: "configured" },
  });

  assert.equal(readiness.codeReady, false);
  assert.equal(readiness.deploymentReady, false);
  assert.equal(readiness.status, "configuration-invalid");
  assert.deepEqual(
    readiness.blockers.map(({ code }) => code),
    ["model-routing-invalid", "governance-boundary-invalid"],
  );
  assert.deepEqual(aiReadinessSchema.parse(readiness), readiness);
});

test("both GET diagnostics publish the same strict readiness contract", async () => {
  const [workspaceResponse, intelligenceResponse] = await Promise.all([
    getWorkspaceDiagnostic(),
    getIntelligenceDiagnostic(),
  ]);
  const workspace = (await workspaceResponse.json()) as Record<string, unknown>;
  const intelligence = (await intelligenceResponse.json()) as Record<
    string,
    unknown
  >;

  for (const diagnostic of [workspace, intelligence]) {
    const readiness = aiReadinessSchema.parse(diagnostic.readiness);
    assert.equal(diagnostic.available, readiness.deploymentReady);
    assert.equal(diagnostic.gateway, readiness.providerReady);
    assert.equal(
      diagnostic.usageProtectionConfigured,
      readiness.usageProtectionReady,
    );
    assert.deepEqual(readiness.governance, governance);
    assert.equal(readiness.routes.standard.primary, routes.standard.model);
    assert.equal(readiness.routes.deep.primary, routes.deep.model);
  }
});
