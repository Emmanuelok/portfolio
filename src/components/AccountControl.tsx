"use client";

import { Cloud, CloudOff, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { getBrowserCloudClient } from "@/lib/cloud/browser";
import { getCloudConfiguration } from "@/lib/cloud/config";

import styles from "./AccountControl.module.css";

type AccountState =
  | Readonly<{ status: "checking" }>
  | Readonly<{ status: "signed-out" }>
  | Readonly<{ status: "signed-in"; email: string }>;

export function AccountControl() {
  const configured = getCloudConfiguration() !== null;
  const [account, setAccount] = useState<AccountState>(
    configured ? { status: "checking" } : { status: "signed-out" },
  );
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const client = getBrowserCloudClient();
    if (!client) return;
    let active = true;

    void client.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      if (!active) return;
      setAccount(data.user
        ? { status: "signed-in", email: data.user.email ?? "Signed-in account" }
        : { status: "signed-out" });
    });
    const { data: listener } = client.auth.onAuthStateChange((
      _event: AuthChangeEvent,
      session: Session | null,
    ) => {
      if (!active) return;
      setAccount(session?.user
        ? { status: "signed-in", email: session.user.email ?? "Signed-in account" }
        : { status: "signed-out" });
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [configured]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch("/auth/sign-out", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (response.ok) setAccount({ status: "signed-out" });
    } finally {
      setSigningOut(false);
    }
  }

  if (!configured) {
    return (
      <Link
        className={styles.trigger}
        data-state="local"
        href="/auth"
        aria-label="Local projects available; cloud projects not configured"
        title="Local projects available; cloud projects not configured"
      >
        <CloudOff aria-hidden="true" />
        <span>Local</span>
      </Link>
    );
  }

  if (account.status === "checking") {
    return (
      <span className={styles.trigger} data-state="checking" aria-label="Checking cloud account">
        <Cloud aria-hidden="true" />
        <span>Cloud</span>
      </span>
    );
  }

  if (account.status === "signed-out") {
    return (
      <Link className={styles.trigger} data-state="signed-out" href="/auth">
        <UserRound aria-hidden="true" />
        <span>Sign in</span>
      </Link>
    );
  }

  return (
    <details className={styles.account}>
      <summary className={styles.trigger} data-state="signed-in" aria-label="Open cloud account menu">
        <Cloud aria-hidden="true" />
        <span>Cloud</span>
      </summary>
      <div className={styles.menu}>
        <p>Cloud access active</p>
        <strong>{account.email}</strong>
        <span>
          Versioned organization projects are available through the secure cloud service. Local projects remain on this device until explicitly uploaded.
        </span>
        <div>
          <Link href="/account">Account and data controls</Link>
          <Link href="/account">Organization access and export</Link>
          <button type="button" onClick={signOut} disabled={signingOut}>
            <LogOut aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </details>
  );
}
