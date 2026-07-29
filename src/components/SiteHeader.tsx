"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CommandPalette } from "@/components/CommandPalette";
import { LivingMark } from "@/components/LivingMark";
import { ThemeControls } from "@/components/ThemeControls";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/work", label: "Work" },
  { href: "/about", label: "About" },
  { href: "/lab", label: "Lab" },
  { href: "/contact", label: "Contact" },
] as const;

type NavigationLinksProps = Readonly<{
  pathname: string;
  onNavigate?: () => void;
}>;

function NavigationLinks({
  pathname,
  onNavigate,
}: NavigationLinksProps) {
  return navigation.map((item) => {
    const isCurrent =
      item.href === "/"
        ? pathname === "/"
        : pathname === item.href || pathname.startsWith(`${item.href}/`);

    return (
      <Link
        className="site-header__nav-link"
        data-current={isCurrent ? "true" : "false"}
        href={item.href}
        aria-current={isCurrent ? "page" : undefined}
        onClick={onNavigate}
        key={item.href}
      >
        <span>{item.label}</span>
      </Link>
    );
  });
}

export function SiteHeader() {
  const pathname = usePathname();
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateHeader = () => setIsScrolled(window.scrollY > 16);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    if (mobileMenuRef.current) mobileMenuRef.current.open = false;
  }, [pathname]);

  const closeMobileMenu = () => {
    if (mobileMenuRef.current) mobileMenuRef.current.open = false;
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header
        className="site-header"
        data-site-header
        data-scrolled={isScrolled ? "true" : "false"}
      >
        <div className="site-header__inner">
          <Link
            className="site-header__brand"
            href="/"
            aria-label="Emmanuel Kingsford Owusu, home"
          >
            <LivingMark
              className="site-header__mark"
              decorative
            />
            <span className="site-header__brand-copy">
              <strong>Emmanuel Kingsford</strong>
              <span>Living Loom</span>
            </span>
          </Link>

          <nav
            className="site-header__desktop-nav"
            aria-label="Primary navigation"
          >
            <NavigationLinks pathname={pathname} />
          </nav>

          <div className="site-header__actions">
            <ThemeControls className="site-header__theme" />
            <CommandPalette className="site-header__command" />
          </div>

          <details
            className="site-header__mobile-menu"
            ref={mobileMenuRef}
          >
            <summary
              className="site-header__mobile-summary"
              aria-label="Navigation menu"
            >
              <span
                className="site-header__mobile-icon"
                aria-hidden="true"
              >
                <span />
                <span />
              </span>
              <span>Menu</span>
            </summary>
            <div className="site-header__mobile-panel">
              <nav aria-label="Mobile navigation">
                <NavigationLinks
                  pathname={pathname}
                  onNavigate={closeMobileMenu}
                />
              </nav>
              <p className="site-header__mobile-note">
                Research, identity, and digital products—woven into
                experiences people can use.
              </p>
              <div className="site-header__mobile-tools">
                <p>Choose a color theme</p>
                <ThemeControls
                  className="site-header__mobile-theme"
                  showLabels
                />
              </div>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}
