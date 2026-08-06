"use client";

import Link from "next/link";

export default function GlobalError({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <html lang="en">
      <body>
        <main className="recovery-page">
          <section aria-labelledby="global-recovery-title">
            <span>Kingxford recovery protocol</span>
            <h1 id="global-recovery-title">The platform shell needs a clean restart.</h1>
            <p>
              Retry now. This recovery screen does not clear projects stored in
              your browser.
            </p>
            <div>
              <button type="button" onClick={reset}>Retry the platform</button>
              <Link href="/">Return home</Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
