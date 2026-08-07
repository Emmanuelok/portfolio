"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

import type { CloudRole } from "@/lib/cloud/contracts";
import type {
  InvitationRole,
  OrganizationAccess,
  OrganizationSummary,
} from "@/lib/cloud/organization-contracts";
import {
  getActiveCloudOrganization,
  setActiveCloudOrganization,
  withActiveCloudOrganization,
} from "@/lib/cloud/organization-selection";

import styles from "./account.module.css";

type DirectoryState =
  | Readonly<{ status: "loading" }>
  | Readonly<{
      status: "ready";
      selectedOrganizationId: string;
      organizations: readonly OrganizationSummary[];
      access: OrganizationAccess;
    }>
  | Readonly<{ status: "unavailable"; message: string }>;

type JsonRecord = Record<string, unknown>;

const allRoles: readonly CloudRole[] = ["owner", "admin", "editor", "reviewer", "viewer"];
const invitationRoleOptions: readonly InvitationRole[] = ["editor", "reviewer", "viewer"];

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function responseMessage(value: unknown, fallback: string) {
  const record = asRecord(value);
  const error = asRecord(record?.error);
  return typeof error?.message === "string" ? error.message.slice(0, 300) : fallback;
}

function createIdempotencyKey(operation: string) {
  return `kx.${operation}.${crypto.randomUUID()}`.slice(0, 160);
}

function requestHeaders(input?: HeadersInit) {
  const headers = withActiveCloudOrganization(input);
  headers.set("Accept", "application/json");
  return headers;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function parseDirectory(value: unknown) {
  const record = asRecord(value);
  const access = asRecord(record?.access);
  if (
    !record
    || typeof record.selectedOrganizationId !== "string"
    || !Array.isArray(record.organizations)
    || !access
    || !Array.isArray(access.members)
    || !Array.isArray(access.invitations)
    || typeof access.canManage !== "boolean"
    || typeof access.actorRole !== "string"
  ) {
    throw new Error("Organization access information is unavailable.");
  }
  return {
    selectedOrganizationId: record.selectedOrganizationId,
    organizations: record.organizations as OrganizationSummary[],
    access: access as unknown as OrganizationAccess,
  };
}

export function OrganizationAccessPanel() {
  const [directory, setDirectory] = useState<DirectoryState>({ status: "loading" });
  const [email, setEmail] = useState("");
  const [invitationRole, setInvitationRole] = useState<InvitationRole>("editor");
  const [expiryHours, setExpiryHours] = useState(72);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [invitationLink, setInvitationLink] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, CloudRole>>({});

  const loadDirectory = useCallback(async (allowSelectionRecovery = true) => {
    try {
      let response = await fetch("/api/cloud/organization", {
        cache: "no-store",
        credentials: "same-origin",
        headers: requestHeaders(),
      });
      if (
        response.status === 403
        && allowSelectionRecovery
        && getActiveCloudOrganization()
      ) {
        setActiveCloudOrganization(null);
        response = await fetch("/api/cloud/organization", {
          cache: "no-store",
          credentials: "same-origin",
          headers: requestHeaders(),
        });
      }
      const body = await response.json() as unknown;
      if (!response.ok) {
        throw new Error(responseMessage(body, "Organization access information is unavailable."));
      }
      const parsed = parseDirectory(body);
      setActiveCloudOrganization(parsed.selectedOrganizationId);
      setRoleDrafts(Object.fromEntries(
        parsed.access.members.map((member) => [member.userId, member.role]),
      ));
      setDirectory({ status: "ready", ...parsed });
    } catch (error) {
      setDirectory({
        status: "unavailable",
        message: error instanceof Error
          ? error.message
          : "Organization access information is unavailable.",
      });
    }
  }, []);

  useEffect(() => {
    const initialization = window.setTimeout(() => {
      void loadDirectory();
    }, 0);
    return () => window.clearTimeout(initialization);
  }, [loadDirectory]);

  async function switchOrganization(organizationId: string) {
    if (busy) return;
    setBusy("switch");
    setMessage("");
    setInvitationLink("");
    setActiveCloudOrganization(organizationId);
    await loadDirectory(false);
    setBusy(null);
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (directory.status !== "ready" || !directory.access.canManage || busy) return;
    setBusy("invite");
    setMessage("");
    setInvitationLink("");
    try {
      const response = await fetch("/api/cloud/organization/invitations", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: requestHeaders({
          "Content-Type": "application/json",
          "Idempotency-Key": createIdempotencyKey("organization-invite"),
        }),
        body: JSON.stringify({
          email,
          role: invitationRole,
          expiresInHours: expiryHours,
        }),
      });
      const body = await response.json() as unknown;
      if (!response.ok) {
        throw new Error(responseMessage(body, "The invitation could not be created."));
      }
      const record = asRecord(body);
      const link = typeof record?.invitationLink === "string" ? record.invitationLink : "";
      setInvitationLink(link);
      setEmail("");
      setMessage(link
        ? "Invitation created. Copy the link now; Kingxford does not retain the link secret."
        : "The invitation already exists. Revoke it and create a replacement if its link was not retained.");
      await loadDirectory(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The invitation could not be created.");
    } finally {
      setBusy(null);
    }
  }

  async function copyInvitationLink() {
    if (!invitationLink) return;
    try {
      await navigator.clipboard.writeText(invitationLink);
      setMessage("Invitation link copied.");
    } catch {
      setMessage("Select and copy the invitation link from the field.");
    }
  }

  async function revokeInvitation(invitationId: string) {
    if (busy) return;
    setBusy(`revoke:${invitationId}`);
    setMessage("");
    try {
      const response = await fetch(
        `/api/cloud/organization/invitations/${encodeURIComponent(invitationId)}`,
        {
          method: "DELETE",
          cache: "no-store",
          credentials: "same-origin",
          headers: requestHeaders({
            "Idempotency-Key": createIdempotencyKey("invitation-revoke"),
          }),
        },
      );
      const body = await response.json() as unknown;
      if (!response.ok) {
        throw new Error(responseMessage(body, "The invitation could not be revoked."));
      }
      setMessage("Invitation revoked.");
      await loadDirectory(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The invitation could not be revoked.");
    } finally {
      setBusy(null);
    }
  }

  async function updateMember(userId: string) {
    if (directory.status !== "ready" || busy) return;
    const role = roleDrafts[userId];
    if (!role) return;
    setBusy(`member:${userId}`);
    setMessage("");
    try {
      const response = await fetch(
        `/api/cloud/organization/members/${encodeURIComponent(userId)}`,
        {
          method: "PATCH",
          cache: "no-store",
          credentials: "same-origin",
          headers: requestHeaders({
            "Content-Type": "application/json",
            "Idempotency-Key": createIdempotencyKey("member-update"),
          }),
          body: JSON.stringify({ role }),
        },
      );
      const body = await response.json() as unknown;
      if (!response.ok) {
        throw new Error(responseMessage(body, "The member role could not be changed."));
      }
      setMessage("Member role updated.");
      await loadDirectory(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The member role could not be changed.");
    } finally {
      setBusy(null);
    }
  }

  async function removeMember(userId: string) {
    if (busy || !window.confirm("Remove this member from the organization?")) return;
    setBusy(`remove:${userId}`);
    setMessage("");
    try {
      const response = await fetch(
        `/api/cloud/organization/members/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
          cache: "no-store",
          credentials: "same-origin",
          headers: requestHeaders({
            "Idempotency-Key": createIdempotencyKey("member-remove"),
          }),
        },
      );
      const body = await response.json() as unknown;
      if (!response.ok) {
        throw new Error(responseMessage(body, "The member could not be removed."));
      }
      setMessage("Member removed from the organization.");
      await loadDirectory(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The member could not be removed.");
    } finally {
      setBusy(null);
    }
  }

  if (directory.status === "loading") {
    return <section className={`${styles.panel} ${styles.accessPanel}`}>Loading organization access…</section>;
  }
  if (directory.status === "unavailable") {
    return (
      <section className={`${styles.panel} ${styles.accessPanel}`}>
        <p className={styles.kicker}>Organization access</p>
        <h2>Access management unavailable</h2>
        <p>{directory.message}</p>
        <button type="button" className={styles.outlineButton} onClick={() => void loadDirectory()}>
          Try again
        </button>
      </section>
    );
  }

  const { access, organizations, selectedOrganizationId } = directory;
  const actorIsOwner = access.actorRole === "owner";
  return (
    <section className={`${styles.panel} ${styles.accessPanel}`}>
      <div className={styles.accessHeading}>
        <div>
          <p className={styles.kicker}>Organization access</p>
          <h2>Members and invitations</h2>
          <p>
            Access changes apply to the selected cloud organization. Browser-local projects remain separate.
          </p>
        </div>
        <label className={styles.organizationSelect}>
          <span>Selected organization</span>
          <select
            value={selectedOrganizationId}
            onChange={(event) => void switchOrganization(event.target.value)}
            disabled={Boolean(busy)}
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name} · {organization.role}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.memberList} aria-label="Organization members">
        {access.members.map((member) => {
          const actorCanManageMember = access.canManage
            && !member.isCurrentUser
            && (actorIsOwner || member.role !== "owner");
          return (
            <article className={styles.memberRow} key={member.userId}>
              <div>
                <strong>{member.email ?? "Account email unavailable"}</strong>
                <span>
                  {member.isCurrentUser ? "Current account · " : ""}
                  Joined {formatDate(member.joinedAt)}
                </span>
              </div>
              {access.canManage ? (
                <div className={styles.memberActions}>
                  <label>
                    <span className={styles.visuallyHidden}>Role for {member.email ?? "member"}</span>
                    <select
                      value={roleDrafts[member.userId] ?? member.role}
                      onChange={(event) => setRoleDrafts((current) => ({
                        ...current,
                        [member.userId]: event.target.value as CloudRole,
                      }))}
                      disabled={!actorCanManageMember || Boolean(busy)}
                    >
                      {allRoles.map((role) => (
                        <option key={role} value={role} disabled={role === "owner" && !actorIsOwner}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={
                      !actorCanManageMember
                      || Boolean(busy)
                      || (roleDrafts[member.userId] ?? member.role) === member.role
                    }
                    onClick={() => void updateMember(member.userId)}
                  >
                    Save role
                  </button>
                  <button
                    type="button"
                    className={styles.removeButton}
                    disabled={!actorCanManageMember || Boolean(busy)}
                    onClick={() => void removeMember(member.userId)}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <span className={styles.roleBadge}>{member.role}</span>
              )}
            </article>
          );
        })}
      </div>

      {access.canManage ? (
        <div className={styles.invitationGrid}>
          <form className={styles.invitationForm} onSubmit={submitInvitation}>
            <h3>Create an invitation</h3>
            <p>Invite an editor, reviewer, or viewer. Links expire and can be used once.</p>
            <label>
              <span>Email address</span>
              <input
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <div className={styles.invitationFields}>
              <label>
                <span>Role</span>
                <select
                  value={invitationRole}
                  onChange={(event) => setInvitationRole(event.target.value as InvitationRole)}
                >
                  {invitationRoleOptions.map((role) => <option key={role}>{role}</option>)}
                </select>
              </label>
              <label>
                <span>Expires</span>
                <select
                  value={expiryHours}
                  onChange={(event) => setExpiryHours(Number(event.target.value))}
                >
                  <option value={24}>In 24 hours</option>
                  <option value={72}>In 3 days</option>
                  <option value={168}>In 7 days</option>
                </select>
              </label>
            </div>
            <button type="submit" disabled={busy === "invite"}>
              {busy === "invite" ? "Creating…" : "Create invitation"}
            </button>
            {invitationLink ? (
              <div className={styles.invitationLink}>
                <label htmlFor="organization-invitation-link">One-time invitation link</label>
                <input id="organization-invitation-link" readOnly value={invitationLink} />
                <button type="button" onClick={() => void copyInvitationLink()}>Copy link</button>
              </div>
            ) : null}
          </form>

          <div className={styles.pendingInvitations}>
            <h3>Pending invitations</h3>
            {access.invitations.length === 0 ? <p>No active invitations.</p> : (
              <ul>
                {access.invitations.map((invitation) => (
                  <li key={invitation.id}>
                    <div>
                      <strong>{invitation.email}</strong>
                      <span>{invitation.role} · expires {formatDate(invitation.expiresAt)}</span>
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void revokeInvitation(invitation.id)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className={styles.readOnlyNotice}>
          Your {access.actorRole} role can use organization projects but cannot change membership.
        </p>
      )}

      <p className={styles.status} role="status" aria-live="polite">{message}</p>
    </section>
  );
}
