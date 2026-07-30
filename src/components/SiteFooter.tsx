import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { KingxfordLogo } from "@/components/KingxfordLogo";

const footerNavigation = [
  { href: "/#studio", label: "Studio" },
  { href: "/#living-room", label: "The Living Room" },
  { href: "/#lab", label: "Lab" },
  { href: "/work", label: "Selected work" },
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
            aria-label="Kingxford home"
          >
            <KingxfordLogo
              className="site-footer__logo"
              decorative
            />
          </Link>
          <p>
            Kingxford is a multidisciplinary creative company where digital
            craft, open-ended creativity, and research become experiences with
            consequence.
          </p>
          <Link className="site-footer__conversation" href="/contact">
            <span>Start a conversation</span>
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
          <p className="site-footer__label">Open source</p>
          <a
            href="https://github.com/Emmanuelok/portfolio"
            target="_blank"
            rel="noreferrer"
          >
            <span>View public GitHub repository</span>
            <ArrowUpRight aria-hidden="true" />
          </a>
          <p>
            Kingxford is an evolving record of products, systems, visual
            experiments, scientific work, and everything between.
          </p>
        </div>

        <div className="site-footer__base">
          <p>
            © {new Date().getFullYear()} Kingxford
          </p>
          <p>Canada · Working worldwide</p>
          <a href="#main-content">Back to top</a>
        </div>
      </div>
    </footer>
  );
}
