import type { Metadata } from "next";

import { AcceptInvitationClient } from "./AcceptInvitationClient";
import styles from "./accept-invitation.module.css";

export const metadata: Metadata = {
  title: "Accept organization invitation",
  description: "Review and accept a time-limited Kingxford organization invitation.",
  robots: { index: false, follow: false },
};

export default function AcceptInvitationPage() {
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <p>Kingxford Cloud · Organization access</p>
        <h1>Accept an invitation.</h1>
        <p>
          Sign in with the exact email address named by the invitation. Acceptance adds cloud organization access; it does not upload browser-local projects.
        </p>
      </header>
      <AcceptInvitationClient />
    </main>
  );
}
