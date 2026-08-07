import { requireCloudUser } from "@/lib/cloud/auth";
import { parseIdempotencyKey, requestFingerprint } from "@/lib/cloud/contracts";
import {
  hashOrganizationInvitationToken,
  invitationAcceptSchema,
} from "@/lib/cloud/organization-contracts";
import { acceptInvitation } from "@/lib/cloud/organization-repository";
import {
  cloudErrorResponse,
  cloudJson,
  parseBoundedJsonRequest,
} from "@/lib/cloud/http";
import { requireCloudMutationRequest } from "@/lib/cloud/request-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireCloudMutationRequest(request, { json: true });
    const [{ client, user }, rawBody] = await Promise.all([
      requireCloudUser(),
      parseBoundedJsonRequest(request, 1_024),
    ]);
    const body = invitationAcceptSchema.parse(rawBody);
    const tokenHash = hashOrganizationInvitationToken(body.token);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const result = await acceptInvitation(client, {
      tokenHash,
      idempotencyKey,
      requestHash: requestFingerprint({
        operation: "organization.invitation.accept",
        userId: user.id,
        tokenHash,
      }),
    });
    return cloudJson({ ok: true, result });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
