import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { KingxfordLogo } from "@/components/KingxfordLogo";

const footerNavigation = [
  { href: "/#mission", label: "Mission" },
  { href: "/lab", label: "R&D / Lab" },
  { href: "/create", label: "Create" },
  { href: "/work", label: "Work" },
  { href: "/media", label: "Media" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

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
            kingXford &amp; Co advances intelligence, R&amp;D, and responsible AI to
            help people and institutions solve complex problems and prepare
            for sustainable abundance.
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
            Studio, The Living Room, and Lab are our delivery environments—not
            the limit of the mission.
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
