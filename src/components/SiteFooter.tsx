import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { KingxfordLogo } from "@/components/KingxfordLogo";
import { PLATFORM_DESTINATIONS } from "@/lib/platform";

const footerNavigation = PLATFORM_DESTINATIONS;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__lead">
          <Link
            className="site-footer__identity"
            href="/"
            aria-label="kingXford & Co home"
          >
            <KingxfordLogo
              className="site-footer__logo"
              decorative
            />
          </Link>
          <p>
            kingXford Atlas connects inquiry, evidence, modelling, making,
            validation, and delivery as one accountable project system.
          </p>
          <Link className="site-footer__conversation" href="/contact">
            <span>Bring a complex problem</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>

        <nav
          className="site-footer__nav"
          aria-label="Footer navigation"
        >
          <p className="site-footer__label">Navigate</p>
          <ul>
            {footerNavigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-footer__source">
          <p className="site-footer__label">Craft signature</p>
          <p>Complex ideas. Unforgettable form.</p>
          <p>
            Conductor coordinates proposals across the lifecycle. People retain
            authority over approval, publication, and consequential decisions.
          </p>
          <p>
            <Link href="/about">About</Link> · <Link href="/contact">Contact</Link>
          </p>
        </div>

        <div className="site-footer__base">
          <p>
            © {new Date().getFullYear()} kingXford &amp; Co
          </p>
          <p>Intelligence · R&amp;D · Responsible AI · Abundant futures</p>
          <a href="#main-content">Back to top</a>
        </div>
      </div>
    </footer>
  );
}
