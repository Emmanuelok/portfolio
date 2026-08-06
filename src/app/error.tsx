"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="recovery-page">
      <section aria-labelledby="recovery-title">
        <span>Kingxford recovery protocol</span>
        <h1 id="recovery-title">This part of the platform needs a clean retry.</h1>
        <p>
          Your browser-stored projects have not been cleared. Retry this view or
          return to the platform home.
        </p>
        <div>
          <button type="button" onClick={reset}>Retry this view</button>
          <Link href="/">Return home</Link>
        </div>
      </section>
    </main>
  );
}
