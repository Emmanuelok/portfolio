import type { CloudRequestContext } from "./auth";
import { isCloudRole, type CloudRole } from "./contracts";
import { CloudHttpError } from "./http";
import {
  invitationRoles,
  type InvitationRole,
  type OrganizationAccess,
  type OrganizationMember,
  type OrganizationSummary,
  type PendingOrganizationInvitation,
} from "./organization-contracts";

type RpcClient = CloudRequestContext["client"];

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseOrganizationSummary(value: unknown): OrganizationSummary {
  const record = asRecord(value);
  if (
    !record
    || typeof record.id !== "string"
    || typeof record.name !== "string"
    || typeof record.slug !== "string"
    || !isCloudRole(record.role)
    || typeof record.joinedAt !== "string"
  ) {
    throw new CloudHttpError(502, "invalid_organization_response", "Organization access data is invalid.");
  }
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    role: record.role,
    joinedAt: record.joinedAt,
  };
}

function parseMember(value: unknown): OrganizationMember {
  const record = asRecord(value);
  if (
    !record
    || typeof record.userId !== "string"
    || (record.email !== null && typeof record.email !== "string")
    || !isCloudRole(record.role)
    || typeof record.joinedAt !== "string"
    || typeof record.isCurrentUser !== "boolean"
  ) {
    throw new CloudHttpError(502, "invalid_organization_response", "Organization member data is invalid.");
  }
  return {
    userId: record.userId,
    email: record.email,
    role: record.role,
    joinedAt: record.joinedAt,
    isCurrentUser: record.isCurrentUser,
  };
}

function parseInvitation(value: unknown): PendingOrganizationInvitation {
  const record = asRecord(value);
  if (
    !record
    || typeof record.id !== "string"
    || typeof record.email !== "string"
    || typeof record.role !== "string"
    || !invitationRoles.includes(record.role as InvitationRole)
    || typeof record.createdAt !== "string"
    || typeof record.expiresAt !== "string"
  ) {
    throw new CloudHttpError(502, "invalid_organization_response", "Organization invitation data is invalid.");
  }
  return {
    id: record.id,
    email: record.email,
    role: record.role as InvitationRole,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  };
}

function mapRpcError(
  error: Readonly<{ code?: string; message?: string }> | null,
  fallbackCode: string,
  fallbackMessage: string,
): never {
  switch (error?.code) {
    case "KX400":
      throw new CloudHttpError(400, "invalid_organization_change", "The organization change is invalid.");
    case "KX401":
      throw new CloudHttpError(401, "authentication_required", "Sign in to continue.");
    case "KX403":
      throw new CloudHttpError(403, "organization_change_denied", error.message || "Your role cannot make this organization change.");
    case "KX404":
      throw new CloudHttpError(404, "organization_record_not_found", "The requested organization record was not found.");
    case "KX409":
      throw new CloudHttpError(409, "organization_change_conflict", error.message || "The organization changed before this request completed.");
    case "KX410":
      throw new CloudHttpError(410, "invitation_unavailable", error.message || "This invitation is no longer available.");
    default:
      throw new CloudHttpError(503, fallbackCode, fallbackMessage);
  }
}

export async function listOrganizations(client: RpcClient) {
  const { data, error } = await client.rpc("list_kingxford_organizations");
  if (error || !Array.isArray(data)) {
    mapRpcError(error, "organizations_unavailable", "Organizations could not be loaded.");
  }
  return data.map(parseOrganizationSummary);
}

export async function getOrganizationAccess(context: CloudRequestContext) {
  const { data, error } = await context.client.rpc("get_kingxford_organization_access", {
    p_organization_id: context.organizationId,
  });
  if (error) {
    mapRpcError(error, "organization_access_unavailable", "Organization access could not be loaded.");
  }
  const record = asRecord(data);
  const organization = asRecord(record?.organization);
  if (
    !record
    || !organization
    || typeof organization.id !== "string"
    || typeof organization.name !== "string"
    || typeof organization.slug !== "string"
    || !isCloudRole(record.actorRole)
    || typeof record.canManage !== "boolean"
    || !Array.isArray(record.members)
    || !Array.isArray(record.invitations)
  ) {
    throw new CloudHttpError(502, "invalid_organization_response", "Organization access data is invalid.");
  }
  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    actorRole: record.actorRole,
    canManage: record.canManage,
    members: record.members.map(parseMember),
    invitations: record.invitations.map(parseInvitation),
  } satisfies OrganizationAccess;
}

type OrganizationMutation = Readonly<{
  status: string;
  replayed: boolean;
  [key: string]: unknown;
}>;

function parseMutation(value: unknown): OrganizationMutation {
  const record = asRecord(value);
  if (!record || typeof record.status !== "string" || typeof record.replayed !== "boolean") {
    throw new CloudHttpError(502, "invalid_organization_response", "The organization service returned an invalid result.");
  }
  return record as OrganizationMutation;
}

export async function createInvitation(
  context: CloudRequestContext,
  input: Readonly<{
    email: string;
    role: InvitationRole;
    expiresAt: string;
    tokenHash: string;
    idempotencyKey: string;
    requestHash: string;
  }>,
) {
  const { data, error } = await context.client.rpc("create_kingxford_organization_invitation", {
    p_organization_id: context.organizationId,
    p_email: input.email,
    p_role: input.role,
    p_expires_at: input.expiresAt,
    p_token_hash: input.tokenHash,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
  if (error) {
    mapRpcError(error, "invitation_create_failed", "The invitation could not be created.");
  }
  return parseMutation(data);
}

export async function revokeInvitation(
  context: CloudRequestContext,
  input: Readonly<{
    invitationId: string;
    idempotencyKey: string;
    requestHash: string;
  }>,
) {
  const { data, error } = await context.client.rpc("revoke_kingxford_organization_invitation", {
    p_organization_id: context.organizationId,
    p_invitation_id: input.invitationId,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
  if (error) {
    mapRpcError(error, "invitation_revoke_failed", "The invitation could not be revoked.");
  }
  return parseMutation(data);
}

export async function manageMember(
  context: CloudRequestContext,
  input: Readonly<{
    userId: string;
    action: "update" | "remove";
    role: CloudRole | null;
    idempotencyKey: string;
    requestHash: string;
  }>,
) {
  const { data, error } = await context.client.rpc("manage_kingxford_organization_member", {
    p_organization_id: context.organizationId,
    p_target_user_id: input.userId,
    p_action: input.action,
    p_role: input.role,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
  if (error) {
    mapRpcError(error, "member_change_failed", "The member change could not be completed.");
  }
  return parseMutation(data);
}

export async function acceptInvitation(
  client: RpcClient,
  input: Readonly<{
    tokenHash: string;
    idempotencyKey: string;
    requestHash: string;
  }>,
) {
  const { data, error } = await client.rpc("accept_kingxford_organization_invitation", {
    p_token_hash: input.tokenHash,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: input.requestHash,
  });
  if (error) {
    mapRpcError(error, "invitation_accept_failed", "The invitation could not be accepted.");
  }
  return parseMutation(data);
}
