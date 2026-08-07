import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

import { cloudRoles, type CloudRole } from "./contracts";

export const invitationRoles = ["editor", "reviewer", "viewer"] as const;
export type InvitationRole = (typeof invitationRoles)[number];

export const ORGANIZATION_INVITATION_LIMIT = 50;
export const ORGANIZATION_INVITATION_MIN_HOURS = 1;
export const ORGANIZATION_INVITATION_MAX_HOURS = 168;
export const ORGANIZATION_INVITATION_DEFAULT_HOURS = 72;

const uuidSchema = z.string().uuid().transform((value) => value.toLowerCase());
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

export const invitationCreateSchema = z.object({
  email: emailSchema,
  role: z.enum(invitationRoles),
  expiresInHours: z
    .number()
    .int()
    .min(ORGANIZATION_INVITATION_MIN_HOURS)
    .max(ORGANIZATION_INVITATION_MAX_HOURS)
    .default(ORGANIZATION_INVITATION_DEFAULT_HOURS),
}).strict();

export const invitationAcceptSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();

export const memberRoleUpdateSchema = z.object({
  role: z.enum(cloudRoles),
}).strict();

export function parseOrganizationMemberId(value: unknown) {
  return uuidSchema.parse(value);
}

export function parseOrganizationInvitationId(value: unknown) {
  return uuidSchema.parse(value);
}

export function createOrganizationInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOrganizationInvitationToken(token: string) {
  const parsed = invitationAcceptSchema.shape.token.parse(token);
  return createHash("sha256").update(parsed, "utf8").digest("hex");
}

export type OrganizationSummary = Readonly<{
  id: string;
  name: string;
  slug: string;
  role: CloudRole;
  joinedAt: string;
}>;

export type OrganizationMember = Readonly<{
  userId: string;
  email: string | null;
  role: CloudRole;
  joinedAt: string;
  isCurrentUser: boolean;
}>;

export type PendingOrganizationInvitation = Readonly<{
  id: string;
  email: string;
  role: InvitationRole;
  createdAt: string;
  expiresAt: string;
}>;

export type OrganizationAccess = Readonly<{
  organization: Readonly<{ id: string; name: string; slug: string }>;
  actorRole: CloudRole;
  canManage: boolean;
  members: readonly OrganizationMember[];
  invitations: readonly PendingOrganizationInvitation[];
}>;
