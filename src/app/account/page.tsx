import type { Metadata } from "next";

import { AccountDataControls } from "./AccountDataControls";
import { OrganizationAccessPanel } from "./OrganizationAccessPanel";
import styles from "./account.module.css";

export const metadata: Metadata = {
  title: "Cloud account",
  description:
    "Review Kingxford cloud account access, export organization data, or remove cloud data.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p>Account · Data controls</p>
        <h1>Cloud project administration.</h1>
        <p>
          Review the organization connected to this session, export its
          records, or remove cloud data. Projects stored only in this browser
          are separate and remain under the local Project Library.
        </p>
      </header>
      <OrganizationAccessPanel />
      <AccountDataControls />
    </main>
  );
}
