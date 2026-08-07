import {
  cloudErrorResponse,
  cloudJson,
  CloudHttpError,
} from "@/lib/cloud/http";
import { createServerCloudClient } from "@/lib/cloud/server";
import { requireCloudMutationRequest } from "@/lib/cloud/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireCloudMutationRequest(request);
    const client = await createServerCloudClient();
    if (!client) {
      throw new CloudHttpError(503, "cloud_not_configured", "Cloud sign-out is not configured on this deployment.");
    }
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) {
      throw new CloudHttpError(503, "sign_out_failed", "The account session could not be closed.");
    }
    return cloudJson({ ok: true, signedOut: true });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
