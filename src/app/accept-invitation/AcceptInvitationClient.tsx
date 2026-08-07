"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { setActiveCloudOrganization } from "@/lib/cloud/organization-selection";

import styles from "./accept-invitation.module.css";

type ViewState =
  | "checking"
  | "ready"
  | "signed-out"
  | "unconfigured"
  | "missing"
  | "submitting"
  | "accepted"
  | "error";

const temporaryTokenKey = "kingxford.cloud.pending-invitation.v1";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const tokenLifetimeMs = 30 * 60 * 1_000;

function storeTemporaryToken(token: string) {
  window.localStorage.setItem(temporaryTokenKey, JSON.stringify({
    token,
    storedAt: Date.now(),
  }));
}

function readTemporaryToken() {
  const value = window.localStorage.getItem(temporaryTokenKey);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { token?: unknown; storedAt?: unknown };
    if (
      typeof parsed.token !== "string"
      || !tokenPattern.test(parsed.token)
      || typeof parsed.storedAt !== "number"
      || Date.now() - parsed.storedAt > tokenLifetimeMs
    ) {
      window.localStorage.removeItem(temporaryTokenKey);
      return null;
    }
    return parsed.token;
  } catch {
    window.localStorage.removeItem(temporaryTokenKey);
    return null;
  }
}

function messageFromResponse(value: unknown, fallback: string) {
  if (!value || typeof value !== "object") return fallback;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message.slice(0, 300) : fallback;
}

export function AcceptInvitationClient() {
  const [view, setView] = useState<ViewState>("checking");
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("Checking cloud access…");
  const [organization, setOrganization] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const initialization = window.setTimeout(() => {
      const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
      let resolvedToken: string | null = null;
      if (fragmentToken && tokenPattern.test(fragmentToken)) {
        resolvedToken = fragmentToken;
        storeTemporaryToken(fragmentToken);
        window.history.replaceState(null, "", "/accept-invitation");
      } else {
        resolvedToken = readTemporaryToken();
      }
      setToken(resolvedToken);
      if (!resolvedToken) {
        setView("missing");
        setMessage("The invitation link is missing or its temporary browser copy has expired.");
        return;
      }

      void fetch("/api/cloud/status", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      }).then(async (response) => {
        const body = await response.json() as {
          authenticated?: unknown;
          cloud?: { configured?: unknown };
        };
        if (!body.cloud?.configured) {
          setView("unconfigured");
          setMessage("Cloud organization access is not configured on this deployment.");
        } else if (!body.authenticated) {
          setView("signed-out");
          setMessage("Sign in with the invited email address before accepting.");
        } else {
          setView("ready");
          setMessage("The invitation is ready for authenticated acceptance.");
        }
      }).catch(() => {
        if (controller.signal.aborted) return;
        setView("error");
        setMessage("Cloud access could not be checked. Try again before accepting.");
      });
    }, 0);
    return () => {
      window.clearTimeout(initialization);
      controller.abort();
    };
  }, []);

  async function accept() {
    if (!token || view === "submitting") return;
    setView("submitting");
    setMessage("Accepting the invitation…");
    try {
      const response = await fetch("/api/cloud/organization/invitations/accept", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Idempotency-Key": `kx.invitation-accept.${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ token }),
      });
      const body = await response.json() as unknown;
      if (!response.ok || !body || typeof body !== "object") {
        throw new Error(messageFromResponse(body, "The invitation could not be accepted."));
      }
      const result = (body as { result?: unknown }).result;
      if (!result || typeof result !== "object") {
        throw new Error("The invitation response is invalid.");
      }
      const organizationId = (result as { organizationId?: unknown }).organizationId;
      const organizationName = (result as { organizationName?: unknown }).organizationName;
      if (typeof organizationId !== "string") {
        throw new Error("The invitation response is invalid.");
      }
      window.localStorage.removeItem(temporaryTokenKey);
      setActiveCloudOrganization(organizationId);
      setOrganization(typeof organizationName === "string" ? organizationName : "the organization");
      setView("accepted");
      setMessage("Organization access added. No local project was uploaded.");
    } catch (error) {
      setView("error");
      setMessage(error instanceof Error ? error.message : "The invitation could not be accepted.");
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="invitation-status-title">
      <p className={styles.kicker}>Invitation status</p>
      <h2 id="invitation-status-title">
        {view === "accepted" ? `Access to ${organization} is active.` : "Secure organization invitation"}
      </h2>
      <p className={styles.message} role={view === "error" ? "alert" : "status"} aria-live="polite">
        {message}
      </p>
      <div className={styles.actions}>
        {view === "signed-out" ? (
          <Link href="/auth?next=%2Faccept-invitation">Sign in to continue</Link>
        ) : null}
        {view === "ready" || view === "error" ? (
          <button type="button" onClick={() => void accept()} disabled={!token}>
            Accept invitation
          </button>
        ) : null}
        {view === "submitting" ? <button type="button" disabled>Accepting…</button> : null}
        {view === "accepted" ? (
          <>
            <Link href="/account">Review organization access</Link>
            <Link href="/create/workspace">Open Project Library</Link>
          </>
        ) : null}
        {view === "missing" || view === "unconfigured" ? (
          <Link href="/account">Return to account controls</Link>
        ) : null}
      </div>
      <p className={styles.note}>
        The link secret is removed from the address bar and retained in this browser for no more than 30 minutes while sign-in completes.
      </p>
    </section>
  );
}
