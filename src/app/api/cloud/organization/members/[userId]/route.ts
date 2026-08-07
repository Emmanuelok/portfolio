import { requireCloudContext } from "@/lib/cloud/auth";
import { parseIdempotencyKey, requestFingerprint } from "@/lib/cloud/contracts";
import {
  memberRoleUpdateSchema,
  parseOrganizationMemberId,
} from "@/lib/cloud/organization-contracts";
import { manageMember } from "@/lib/cloud/organization-repository";
import {
  cloudErrorResponse,
  cloudJson,
  parseBoundedJsonRequest,
} from "@/lib/cloud/http";
import { requireCloudMutationRequest } from "@/lib/cloud/request-security";

export const runtime = "nodejs";

type MemberRouteContext = Readonly<{
  params: Promise<{ userId: string }>;
}>;

export async function PATCH(request: Request, routeContext: MemberRouteContext) {
  try {
    requireCloudMutationRequest(request, { json: true });
    const [context, params, rawBody] = await Promise.all([
      requireCloudContext(request),
      routeContext.params,
      parseBoundedJsonRequest(request, 1_024),
    ]);
    const userId = parseOrganizationMemberId(params.userId);
    const body = memberRoleUpdateSchema.parse(rawBody);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const requestHash = requestFingerprint({
      operation: "organization.member.update",
      organizationId: context.organizationId,
      userId,
      role: body.role,
    });
    const result = await manageMember(context, {
      userId,
      action: "update",
      role: body.role,
      idempotencyKey,
      requestHash,
    });
    return cloudJson({ ok: true, result });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function DELETE(request: Request, routeContext: MemberRouteContext) {
  try {
    requireCloudMutationRequest(request);
    const [context, params] = await Promise.all([
      requireCloudContext(request),
      routeContext.params,
    ]);
    const userId = parseOrganizationMemberId(params.userId);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const requestHash = requestFingerprint({
      operation: "organization.member.remove",
      organizationId: context.organizationId,
      userId,
    });
    const result = await manageMember(context, {
      userId,
      action: "remove",
      role: null,
      idempotencyKey,
      requestHash,
    });
    return cloudJson({ ok: true, result });
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
