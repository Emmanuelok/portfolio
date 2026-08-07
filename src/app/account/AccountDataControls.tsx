"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  setActiveCloudOrganization,
  withActiveCloudOrganization,
} from "@/lib/cloud/organization-selection";

import styles from "./account.module.css";

type AccountRecord = Readonly<{
  user: Readonly<{ email: string | null }>;
  organization: Readonly<{ id: string; name: string; slug: string }>;
  role: string;
}>;

type AccountState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "ready"; record: AccountRecord }>
  | Readonly<{ status: "unavailable"; message: string }>;

const confirmationPhrase = "DELETE MY CLOUD DATA";

function responseMessage(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as {
    error?: { message?: unknown };
  };
  return typeof candidate.error?.message === "string"
    ? candidate.error.message.slice(0, 300)
    : fallback;
}

export function AccountDataControls() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountState>({ status: "loading" });
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/cloud/account", {
      credentials: "same-origin",
      headers: withActiveCloudOrganization({ Accept: "application/json" }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as unknown;
        if (!response.ok || !body || typeof body !== "object") {
          throw new Error(responseMessage(body, "Cloud account information is unavailable."));
        }
        const candidate = body as { user?: unknown; organization?: unknown; role?: unknown };
        if (
          !candidate.user ||
          typeof candidate.user !== "object" ||
          !candidate.organization ||
          typeof candidate.organization !== "object" ||
          typeof candidate.role !== "string"
        ) {
          throw new Error("Cloud account information is unavailable.");
        }
        const user = candidate.user as { email?: unknown };
        const organization = candidate.organization as {
          name?: unknown;
          slug?: unknown;
          id?: unknown;
        };
        if (
          (user.email !== null && typeof user.email !== "string") ||
          typeof organization.id !== "string" ||
          typeof organization.name !== "string" ||
          typeof organization.slug !== "string"
        ) {
          throw new Error("Cloud account information is unavailable.");
        }
        setAccount({
          status: "ready",
          record: {
            user: { email: user.email ?? null },
            organization: {
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
            },
            role: candidate.role,
          },
        });
        setActiveCloudOrganization(organization.id);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setAccount({
          status: "unavailable",
          message:
            error instanceof Error
              ? error.message
              : "Cloud account information is unavailable.",
        });
      });
    return () => controller.abort();
  }, []);

  async function deleteCloudData() {
    if (
      account.status !== "ready"
      || confirmation !== confirmationPhrase
      || deleting
    ) return;
    setDeleting(true);
    setDeleteStatus("Removing cloud data…");
    try {
      const headers = withActiveCloudOrganization({
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": `account-delete:${crypto.randomUUID()}`,
      });
      headers.set("X-Kingxford-Organization-Id", account.record.organization.id);
      const response = await fetch("/api/cloud/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({
          confirmation: confirmationPhrase,
          organizationId: account.record.organization.id,
        }),
      });
      const body = (await response.json()) as unknown;
      if (!response.ok) {
        setDeleteStatus(
          responseMessage(
            body,
            "Cloud data could not be removed. No local project was changed.",
          ),
        );
        return;
      }
      setDeleteStatus(
        "Cloud data was removed. Local projects on this device were not changed.",
      );
      window.setTimeout(() => router.push("/auth"), 900);
    } catch {
      setDeleteStatus(
        "Cloud data could not be removed. No local project was changed.",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (account.status === "loading") {
    return <section className={styles.panel}>Checking the current session…</section>;
  }
  if (account.status === "unavailable") {
    return (
      <section className={styles.panel}>
        <h2>Cloud account unavailable</h2>
        <p>{account.message}</p>
        <Link href="/auth?next=/account">Sign in or review configuration</Link>
      </section>
    );
  }

  const { record } = account;
  return (
    <div className={styles.grid}>
      <section className={styles.panel}>
        <p className={styles.kicker}>Current session</p>
        <h2>{record.organization.name}</h2>
        <dl>
          <div>
            <dt>Account</dt>
            <dd>{record.user.email ?? "Signed-in account"}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{record.organization.slug}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{record.role}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <a href={`/api/cloud/export?organization=${encodeURIComponent(record.organization.id)}`}>
            Export cloud data
          </a>
          <Link href="/create/workspace">Open Project Library</Link>
        </div>
      </section>

      <section className={`${styles.panel} ${styles.danger}`}>
        <p className={styles.kicker}>Deletion control</p>
        <h2>Remove cloud data</h2>
        <p>
          This removes the cloud records available to this account or
          organization role. It does not remove browser-local projects. An
          organization owner may need to transfer ownership before deletion.
        </p>
        <label htmlFor="cloud-delete-confirmation">
          Type <strong>{confirmationPhrase}</strong> to continue
        </label>
        <input
          id="cloud-delete-confirmation"
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <button
          type="button"
          disabled={confirmation !== confirmationPhrase || deleting}
          onClick={deleteCloudData}
        >
          {deleting ? "Removing…" : "Remove cloud data"}
        </button>
        <p role="status" aria-live="polite" className={styles.status}>
          {deleteStatus}
        </p>
      </section>
    </div>
  );
}
