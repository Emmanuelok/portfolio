import { requireCloudContext } from "@/lib/cloud/auth";
import { parseIdempotencyKey, requestFingerprint } from "@/lib/cloud/contracts";
import {
  createOrganizationInvitationToken,
  hashOrganizationInvitationToken,
  invitationCreateSchema,
} from "@/lib/cloud/organization-contracts";
import { createInvitation } from "@/lib/cloud/organization-repository";
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
    const [context, rawBody] = await Promise.all([
      requireCloudContext(request),
      parseBoundedJsonRequest(request, 2_048),
    ]);
    const body = invitationCreateSchema.parse(rawBody);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const requestHash = requestFingerprint({
      operation: "organization.invitation.create",
      organizationId: context.organizationId,
      email: body.email,
      role: body.role,
      expiresInHours: body.expiresInHours,
    });
    const token = createOrganizationInvitationToken();
    const expiresAt = new Date(
      Date.now() + body.expiresInHours * 60 * 60 * 1_000,
    ).toISOString();
    const result = await createInvitation(context, {
      email: body.email,
      role: body.role,
      expiresAt,
      tokenHash: hashOrganizationInvitationToken(token),
      idempotencyKey,
      requestHash,
    });

    const invitationLink = result.replayed
      ? null
      : `${request.headers.get("origin")}/accept-invitation#token=${token}`;
    return cloudJson(
      {
        ok: true,
        result,
        invitationLink,
        linkAvailableOnce: true,
      },
      { status: result.replayed ? 200 : 201 },
    );
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
