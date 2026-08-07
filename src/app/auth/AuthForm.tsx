"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { getBrowserCloudClient } from "@/lib/cloud/browser";

import styles from "./auth.module.css";

type AuthFormProps = Readonly<{
  configured: boolean;
  returnPath: string;
}>;

export function AuthForm({ configured, returnPath }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || status === "submitting") return;
    const client = getBrowserCloudClient();
    if (!client) {
      setStatus("error");
      setMessage("Cloud sign-in is not configured on this deployment.");
      return;
    }

    setStatus("submitting");
    setMessage("");
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", returnPath);
    const { error } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: redirect.toString(),
        shouldCreateUser: true,
      },
    });
    if (error) {
      setStatus("error");
      setMessage("The sign-in email could not be sent. Check the address and try again.");
      return;
    }
    setStatus("sent");
    setMessage("Check your inbox for the secure sign-in link. You may close this page after opening it.");
  }

  return (
    <div className={styles.panel}>
      <div className={styles.status} data-configured={configured ? "true" : "false"}>
        <span aria-hidden="true" />
        {configured ? "Cloud service configured" : "Local workspace available"}
      </div>

      {configured ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="cloud-auth-email">Work email</label>
          <input
            id="cloud-auth-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={status === "submitting" || status === "sent"}
          />
          <button type="submit" disabled={status === "submitting" || status === "sent"}>
            {status === "submitting" ? "Sending secure link…" : status === "sent" ? "Link sent" : "Continue securely"}
          </button>
          <p className={styles.formNote}>
            Kingxford uses a time-limited email link. No password is stored by this application.
          </p>
          {message ? (
            <p className={styles.message} role={status === "error" ? "alert" : "status"} data-error={status === "error" ? "true" : "false"}>
              {message}
            </p>
          ) : null}
        </form>
      ) : (
        <div className={styles.localNotice}>
          <h2>Cloud projects are not configured.</h2>
          <p>
            Canvas and Atlas continue to work locally in this browser. No cloud upload or account action is implied.
          </p>
          <Link href={returnPath}>Continue with local projects</Link>
        </div>
      )}

      <ul className={styles.assurances} aria-label="Cloud project safeguards">
        <li><strong>Local-first</strong><span>Your browser workspace remains available with or without an account.</span></li>
        <li><strong>Organization boundaries</strong><span>Cloud records are isolated by membership and role.</span></li>
        <li><strong>Versioned work</strong><span>Conflicts are surfaced before one cloud version can replace another.</span></li>
      </ul>
    </div>
  );
}
