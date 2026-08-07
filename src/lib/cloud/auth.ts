import type { User } from "@supabase/supabase-js";

import { isCloudRole, parseOrganizationId, type CloudRole } from "./contracts";
import { CloudHttpError } from "./http";
import { createServerCloudClient } from "./server";

type ServerCloudClient = NonNullable<Awaited<ReturnType<typeof createServerCloudClient>>>;

export type CloudUserContext = Readonly<{
  client: ServerCloudClient;
  user: User;
}>;

export type CloudRequestContext = Readonly<{
  client: ServerCloudClient;
  user: User;
  organizationId: string;
  role: CloudRole;
}>;

export async function requireCloudUser(): Promise<CloudUserContext> {
  const client = await createServerCloudClient();
  if (!client) {
    throw new CloudHttpError(
      503,
      "cloud_not_configured",
      "Cloud projects are not configured on this deployment. Local Canvas and Atlas projects remain available.",
    );
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new CloudHttpError(401, "authentication_required", "Sign in to use secure cloud projects.");
  }
  return { client, user: data.user };
}

type MembershipRow = Readonly<{
  organization_id: string;
  role: CloudRole;
}>;

function parseMembershipRow(value: unknown): MembershipRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.organization_id !== "string" || !isCloudRole(row.role)) return null;
  return {
    organization_id: parseOrganizationId(row.organization_id),
    role: row.role,
  };
}

async function findMembership(
  client: ServerCloudClient,
  userId: string,
  requestedOrganizationId: string | null,
) {
  let query = client
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId);

  query = requestedOrganizationId
    ? query.eq("organization_id", requestedOrganizationId)
    : query.order("joined_at", { ascending: true }).limit(1);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new CloudHttpError(503, "membership_unavailable", "Organization access could not be verified.");
  }
  return parseMembershipRow(data);
}

export async function requireCloudContext(request: Request): Promise<CloudRequestContext> {
  const { client, user } = await requireCloudUser();

  const requestUrl = new URL(request.url);
  const queryOrganizationId =
    request.method === "GET" || request.method === "HEAD"
      ? requestUrl.searchParams.get("organization")
      : null;
  const rawOrganizationId =
    request.headers.get("x-kingxford-organization-id") ?? queryOrganizationId;
  let requestedOrganizationId: string | null = null;
  if (rawOrganizationId) {
    try {
      requestedOrganizationId = parseOrganizationId(rawOrganizationId);
    } catch {
      throw new CloudHttpError(400, "invalid_organization", "The organization identifier is invalid.");
    }
  }

  let membership = await findMembership(client, user.id, requestedOrganizationId);
  if (!membership && !requestedOrganizationId) {
    const { data: organizationId, error: provisionError } = await client.rpc(
      "ensure_personal_organization",
    );
    if (provisionError || typeof organizationId !== "string") {
      throw new CloudHttpError(503, "organization_unavailable", "A cloud organization could not be prepared.");
    }
    membership = await findMembership(client, user.id, parseOrganizationId(organizationId));
  }

  if (!membership) {
    throw new CloudHttpError(403, "organization_access_denied", "You do not have access to this organization.");
  }

  return {
    client,
    user,
    organizationId: membership.organization_id,
    role: membership.role,
  };
}
