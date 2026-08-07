import type { Metadata } from "next";
import Link from "next/link";

import { getCloudAvailability } from "@/lib/cloud/config";
import { safeCloudReturnPath } from "@/lib/cloud/navigation";

import { AuthForm } from "./AuthForm";
import styles from "./auth.module.css";

export const metadata: Metadata = {
  title: "Cloud projects",
  description: "Sign in to use versioned Kingxford cloud projects while retaining local-first access.",
  robots: { index: false, follow: false },
};

type AuthPageProps = Readonly<{
  searchParams: Promise<{ next?: string }>;
}>;

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const { next } = await searchParams;
  const returnPath = safeCloudReturnPath(next);
  const availability = getCloudAvailability();

  return (
    <main className={styles.page} id="main-content">
      <section className={styles.introduction}>
        <p>Kingxford Cloud · Optional account</p>
        <h1>Continue the same project across devices.</h1>
        <div>
          <p>
            Sign in when you need secure cloud versions, organization access, and recovery. Local work remains available without an account.
          </p>
          <Link href={returnPath}>Return to the workspace</Link>
        </div>
      </section>
      <AuthForm configured={availability.configured} returnPath={returnPath} />
    </main>
  );
}
