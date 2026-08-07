import { requireCloudContext } from "@/lib/cloud/auth";
import { cloudErrorResponse, cloudJson } from "@/lib/cloud/http";
import { listCloudProjects } from "@/lib/cloud/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const context = await requireCloudContext(request);
    const projects = await listCloudProjects(context);
    return cloudJson({
      ok: true,
      organizationId: context.organizationId,
      role: context.role,
      projects,
    });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
