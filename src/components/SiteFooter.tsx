import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { KingxfordLogo } from "@/components/KingxfordLogo";

const footerNavigation = [
  { href: "/#mission", label: "Mission" },
  { href: "/create", label: "Create" },
  { href: "/lab", label: "Lab" },
  { href: "/work", label: "Work" },
  { href: "/media", label: "Field notes" },
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
            kingXford &amp; Co researches complex problems and builds responsible
            digital products, AI-assisted workflows, and institutional systems.
          </p>
          <Link className="site-footer__conversation" href="/contact">
            <span>Discuss a project</span>
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
          <p className="site-footer__label">Design principle</p>
          <p>Complex ideas, clearly designed and carefully delivered.</p>
          <p>From discovery and evidence to tested delivery.</p>
        </div>

        <div className="site-footer__base">
          <p>
            © {new Date().getFullYear()} kingXford &amp; Co
          </p>
          <p>Research · Digital products · Responsible AI</p>
          <a href="#main-content">Back to top</a>
        </div>
      </div>
    </footer>
  );
}
