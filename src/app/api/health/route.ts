import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { getContactDeliveryReadiness } from "@/lib/contact/configuration";
import { hasGatewayAuth } from "@/lib/intelligence/readiness";
import { workspaceUsageBackend } from "@/lib/workspace/usage-policy";

export const dynamic = "force-dynamic";

function configured(value: string | undefined) {
  return Boolean(value?.trim());
}

export async function GET() {
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
  const productionCoreReady = gateway && usageSalt && usage.durable;

  return NextResponse.json(
    {
      service: "kingxford-platform",
      status: productionCoreReady ? "operational" : "configuration-required",
      checkedAt: new Date().toISOString(),
      requestId,
      capabilities: {
        publicSite: true,
        localWorkspace: true,
        aiProviderConfigured: gateway,
        pseudonymousUsageIdentityConfigured: usageSalt,
        distributedUsageConfigured: usage.durable,
        cloudWorkspaceConfigured: cloud,
        privateEvidenceStorageConfigured: privateEvidenceStorage,
        durableReviewWorkflowConfigured: workflowPersistence,
        enquiryDeliveryConfigured: enquiry,
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Kingxford-Request-Id": requestId,
      },
    },
  );
}
