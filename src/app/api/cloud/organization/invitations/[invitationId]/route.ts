import { requireCloudContext } from "@/lib/cloud/auth";
import { parseIdempotencyKey, requestFingerprint } from "@/lib/cloud/contracts";
import { parseOrganizationInvitationId } from "@/lib/cloud/organization-contracts";
import { revokeInvitation } from "@/lib/cloud/organization-repository";
import { cloudErrorResponse, cloudJson } from "@/lib/cloud/http";
import { requireCloudMutationRequest } from "@/lib/cloud/request-security";

export const runtime = "nodejs";

type InvitationRouteContext = Readonly<{
  params: Promise<{ invitationId: string }>;
}>;

export async function DELETE(request: Request, routeContext: InvitationRouteContext) {
  try {
    requireCloudMutationRequest(request);
    const [context, params] = await Promise.all([
      requireCloudContext(request),
      routeContext.params,
    ]);
    const invitationId = parseOrganizationInvitationId(params.invitationId);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const requestHash = requestFingerprint({
      operation: "organization.invitation.revoke",
      organizationId: context.organizationId,
      invitationId,
    });
    const result = await revokeInvitation(context, {
      invitationId,
      idempotencyKey,
      requestHash,
    });
    return cloudJson({ ok: true, result });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
