import { requireCloudContext } from "@/lib/cloud/auth";
import { cloudErrorResponse, cloudJson } from "@/lib/cloud/http";
import {
  getOrganizationAccess,
  listOrganizations,
} from "@/lib/cloud/organization-repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requireCloudContext(request);
    const [organizations, access] = await Promise.all([
      listOrganizations(context.client),
      getOrganizationAccess(context),
    ]);
    return cloudJson({
      ok: true,
      selectedOrganizationId: context.organizationId,
      organizations,
      access,
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
