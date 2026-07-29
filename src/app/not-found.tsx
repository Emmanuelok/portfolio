import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { LivingMark } from "@/components/LivingMark";

export default function NotFound() {
  return (
    <main className="not-found">
      <div className="not-found__signal" aria-hidden="true">
        <LivingMark decorative />
        <span>404</span>
      </div>
      <div className="not-found__content">
        <p className="eyebrow">Wrong turn · Right place</p>
        <h1>This route left the composition.</h1>
        <p>
          The page may have moved, changed shape, or never belonged to this
          system. The selected work is still exactly where it should be.
        </p>
        <div className="not-found__actions">
          <Link className="button button--primary" href="/work">
            <span>Explore the work</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link className="button button--quiet" href="/">
            <ArrowLeft aria-hidden="true" />
            <span>Return home</span>
          </Link>
        </div>
      </div>
      <div className="not-found__coordinates" aria-hidden="true">
        <span>ROUTE / UNKNOWN</span>
        <span>SIGNAL / LOST</span>
        <span>EK / PORTFOLIO</span>
      </div>
    </main>
  );
}
