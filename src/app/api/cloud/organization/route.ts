import { requireCloudContext } from "@/lib/cloud/auth";
import { parseIdempotencyKey, requestFingerprint } from "@/lib/cloud/contracts";
import {
  cloudErrorResponse,
  cloudJson,
  parseBoundedJsonRequest,
} from "@/lib/cloud/http";
import {
  organizationCreateSchema,
  organizationRenameSchema,
} from "@/lib/cloud/organization-contracts";
import {
  createOrganization,
  getOrganizationAccess,
  listOrganizations,
  renameOrganization,
} from "@/lib/cloud/organization-repository";
import { requireCloudMutationRequest } from "@/lib/cloud/request-security";

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

export async function POST(request: Request) {
  try {
    requireCloudMutationRequest(request, { json: true });
    const [context, rawBody] = await Promise.all([
      requireCloudContext(request),
      parseBoundedJsonRequest(request, 1_024),
    ]);
    const body = organizationCreateSchema.parse(rawBody);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const requestHash = requestFingerprint({
      operation: "organization.create",
      userId: context.user.id,
      name: body.name,
    });
    const result = await createOrganization(context.client, {
      name: body.name,
      idempotencyKey,
      requestHash,
    });
    return cloudJson(
      { ok: true, result },
      {
        status: result.replayed ? 200 : 201,
        headers: { "Idempotency-Replayed": result.replayed ? "true" : "false" },
      },
    );
  } catch (error) {
    return cloudErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireCloudMutationRequest(request, { json: true });
    const [context, rawBody] = await Promise.all([
      requireCloudContext(request),
      parseBoundedJsonRequest(request, 1_024),
    ]);
    const body = organizationRenameSchema.parse(rawBody);
    const idempotencyKey = parseIdempotencyKey(request.headers.get("idempotency-key"));
    const requestHash = requestFingerprint({
      operation: "organization.rename",
      organizationId: context.organizationId,
      name: body.name,
    });
    const result = await renameOrganization(context, {
      name: body.name,
      idempotencyKey,
      requestHash,
    });
    return cloudJson(
      { ok: true, result },
      { headers: { "Idempotency-Replayed": result.replayed ? "true" : "false" } },
    );
  } catch (error) {
    return cloudErrorResponse(error);
  }
}
