import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getContactDeliveryReadiness } from "@/lib/contact/configuration";
import { getIntelligenceModelRoute } from "@/lib/intelligence/agents";
import { buildAiReadiness, hasGatewayAuth } from "@/lib/intelligence/readiness";
import { workspaceUsageBackend } from "@/lib/workspace/usage-policy";

export const dynamic = "force-dynamic";

const CORE_CAPABILITIES = [
  "cloudWorkspaceConfigured",
  "distributedUsageConfigured",
  "enquiryDeliveryConfigured",
  "aiProviderConfigured",
  "pseudonymousUsageIdentityConfigured",
] as const;

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

function strictModeRequested(request: Request | undefined) {
  if (!request) return false;
  const requested = new URL(request.url).searchParams.get("strict");
  return requested !== null && requested !== "0" && requested !== "false";
}

export async function GET(request?: Request) {
  const requestId = randomUUID();
  const usage = workspaceUsageBackend();
  const gateway = hasGatewayAuth();
  const usageSalt =
    (process.env.KINGXFORD_USAGE_HASH_SALT?.trim().length ?? 0) >= 32;
  const cloud =
    configured(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    (configured(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
      configured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  const enquiry = getContactDeliveryReadiness().configured;
  const workflowPersistence =
    cloud &&
    configured(process.env.SUPABASE_SERVICE_ROLE_KEY) &&
    usage.durable;
  const privateEvidenceStorage =
    cloud && configured(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const capabilities = {
    publicSite: true,
    localWorkspace: true,
    aiProviderConfigured: gateway,
    pseudonymousUsageIdentityConfigured: usageSalt,
    distributedUsageConfigured: usage.durable,
    cloudWorkspaceConfigured: cloud,
    privateEvidenceStorageConfigured: privateEvidenceStorage,
    durableReviewWorkflowConfigured: workflowPersistence,
    enquiryDeliveryConfigured: enquiry,
  };
  const missingCore = CORE_CAPABILITIES.filter((name) => !capabilities[name]);
  const coreReady = missingCore.length === 0;
  const strict = strictModeRequested(request);
  const readiness = buildAiReadiness({
    routes: {
      standard: getIntelligenceModelRoute("standard"),
      deep: getIntelligenceModelRoute("deep"),
    },
    usageProtectionReady: usageSalt && usage.durable,
    toolsEnabled: false,
    automaticApplyEnabled: false,
    gateApprovalMode: "human-only",
  });

  return NextResponse.json(
    {
      service: "kingxford-platform",
      status: coreReady ? "operational" : "configuration-required",
      checkedAt: new Date().toISOString(),
      requestId,
      capabilities,
      core: {
        required: CORE_CAPABILITIES,
        missing: missingCore,
        ready: coreReady,
        strictModeRequested: strict,
      },
      providerModelRouting: {
        configuredModels: readiness.routes,
        authMethod: readiness.provider.authMethod,
        providerModelsVerified: readiness.provider.modelCatalogVerifiedAtRequest,
        liveConnectionVerified: readiness.provider.liveConnectionVerified,
      },
    },
    {
      status: strict && !coreReady ? 503 : 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Kingxford-Request-Id": requestId,
      },
    },
  );
}
