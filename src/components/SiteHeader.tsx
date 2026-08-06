"use client";

import {
  ArrowUpRight,
  Braces,
  ChevronDown,
  Code2,
  FileText,
  Lightbulb,
  Network,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import { CommandPalette } from "@/components/CommandPalette";
import { KingxfordLogo } from "@/components/KingxfordLogo";
import { ThemeControls } from "@/components/ThemeControls";
import {
  CREATE_CATALOGUE_DESTINATIONS,
  CREATE_PROOF_DESTINATIONS,
  PLATFORM_DESTINATIONS,
} from "@/lib/platform";

const navigationBeforeCreate = PLATFORM_DESTINATIONS.filter(
  ({ href }) => href !== "/create",
);

const createModes = [
  {
    href: "/create/workspace?mode=idea",
    label: "Idea",
    description: "Shape the need",
    icon: Lightbulb,
  },
  {
    href: "/create/workspace?mode=code",
    label: "Code",
    description: "Run a prototype",
    icon: Code2,
  },
  {
    href: "/create/workspace?mode=mindmap",
    label: "Mind map",
    description: "Move the system",
    icon: Network,
  },
  {
    href: "/create/workspace?mode=prompt",
    label: "Prompt",
    description: "Test instructions",
    icon: Braces,
  },
  {
    href: "/create/workspace?mode=brief",
    label: "Brief",
    description: "Make it buildable",
    icon: FileText,
  },
] as const;

type NavigationItem = Readonly<{ href: string; label: string }>;

type NavigationLinksProps = Readonly<{
  items: readonly NavigationItem[];
  pathname: string;
  onNavigate?: () => void;
}>;

function isCurrentPath(pathname: string, href: string) {
  if (href.includes("#")) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLinks({
  items,
  pathname,
  onNavigate,
}: NavigationLinksProps) {
  return items.map((item) => {
    const isCurrent = isCurrentPath(pathname, item.href);

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

type CreateDesktopMenuProps = Readonly<{
  pathname: string;
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
}>;

function CreateDesktopMenu({
  pathname,
  isOpen,
  onClose,
  onToggle,
  menuRef,
  triggerRef,
}: CreateDesktopMenuProps) {
  const isCreateCurrent = pathname === "/create" || pathname.startsWith("/create/");

  return (
    <div
      className="site-header__create-menu"
      data-open={isOpen ? "true" : "false"}
      data-current={isCreateCurrent ? "true" : "false"}
      ref={menuRef}
    >
      <Link
        className="site-header__nav-link site-header__create-link"
        href="/create"
        aria-current={
          pathname === "/create"
            ? "page"
            : isCreateCurrent
              ? "location"
              : undefined
        }
        data-current={isCreateCurrent ? "true" : "false"}
        onClick={onClose}
      >
        <span>Create</span>
      </Link>
      <button
        className="site-header__create-disclosure"
        type="button"
        ref={triggerRef}
        aria-label={`${isOpen ? "Close" : "Open"} Create menu`}
        aria-expanded={isOpen}
        aria-controls="site-header-create-panel"
        onClick={onToggle}
      >
        <ChevronDown aria-hidden="true" />
      </button>

      {isOpen ? (
        <section
          className="site-header__create-panel"
          id="site-header-create-panel"
          aria-label="Create catalogue, concept proofs, and Kingxford Canvas"
        >
          <header className="site-header__create-panel-topline">
            <span>Create · Seven directions · Three live proofs · One Atlas</span>
            <span className="site-header__create-live">
              <i aria-hidden="true" /> Conductor ready
            </span>
          </header>

          <div className="site-header__create-panel-grid">
            <div className="site-header__create-intro">
              <span className="site-header__create-kicker">One project · Six connected phases</span>
              <h2>Choose what to create. Keep the whole project connected.</h2>
              <p>
                Explore seven complete creation directions, inspect live concept
                proofs, or take an idea directly into Canvas and its Project Atlas.
              </p>
              <nav
                className="site-header__create-catalogue"
                aria-label="Seven creation directions"
              >
                {CREATE_CATALOGUE_DESTINATIONS.map((item) => (
                  <Link href={item.href} onClick={onClose} key={item.slug}>
                    <small>{item.index}</small>
                    <span>{item.shortLabel}</span>
                  </Link>
                ))}
              </nav>
              <Link href="/create#catalogue" onClick={onClose}>
                Explore the complete Create catalogue
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>

            <Link
              className="site-header__create-canvas"
              href="/create/workspace"
              onClick={onClose}
            >
              <span className="site-header__create-canvas-label">
                <Sparkles aria-hidden="true" /> Live project workspace
              </span>
              <strong>Open the workspace</strong>
              <p>
                Work with any creative input on the left. Inspect the result,
                evidence, specialist review, and versions on the right.
              </p>
              <span className="site-header__create-canvas-panes" aria-hidden="true">
                <i><b>Input</b><em>Idea · Code · Map</em></i>
                <i><b>Live</b><em>Preview · Review</em></i>
              </span>
              <span className="site-header__create-canvas-cta">
                Continue the same project <ArrowUpRight aria-hidden="true" />
              </span>
            </Link>

            <div className="site-header__create-start">
              <div>
                <span>Choose an instrument</span>
                <small>Your work stays on this device</small>
              </div>
              <div className="site-header__create-modes">
                {createModes.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link href={item.href} onClick={onClose} key={item.href}>
                      <span><Icon aria-hidden="true" /></span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <footer className="site-header__create-panel-footer">
            <div className="site-header__create-proofs" aria-label="Interactive concept demonstrations">
              <span>Explore live starting proofs</span>
              {CREATE_PROOF_DESTINATIONS.map((item) => (
                <Link href={item.href} onClick={onClose} key={item.href}>
                  <small>{item.index}</small> {item.label}
                </Link>
              ))}
            </div>
            <Link
              className="site-header__create-build"
              href="/contact?brief=create"
              onClick={onClose}
            >
              <span>Ready to go further?</span>
              Let kingXford build it
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

type CreateMobileMenuProps = Readonly<{
  pathname: string;
  onNavigate: () => void;
}>;

function CreateMobileMenu({ pathname, onNavigate }: CreateMobileMenuProps) {
  const isCreateCurrent = pathname === "/create" || pathname.startsWith("/create/");
  const isWorkspaceCurrent = pathname.startsWith("/create/workspace");

  return (
    <details
      className="site-header__mobile-create"
      data-current={isCreateCurrent ? "true" : "false"}
      open={isCreateCurrent || undefined}
      key={pathname}
    >
      <summary>
        <span>
          <strong>Create</strong>
          <small>Seven directions · Canvas · Live proofs</small>
        </span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="site-header__mobile-create-panel">
        <Link
          className="site-header__mobile-canvas"
          href="/create/workspace"
          aria-current={isWorkspaceCurrent ? "page" : undefined}
          onClick={onNavigate}
        >
          <span><Sparkles aria-hidden="true" /> Kingxford Intelligence</span>
          <strong>Open the workspace</strong>
          <small>Source · Live result · Conductor · Versions</small>
          <ArrowUpRight aria-hidden="true" />
        </Link>

        <div className="site-header__mobile-create-modes" aria-label="Start in Canvas">
          {createModes.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} onClick={onNavigate} key={item.href}>
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <nav
          className="site-header__mobile-create-catalogue"
          aria-label="Seven creation directions"
        >
          {CREATE_CATALOGUE_DESTINATIONS.map((item) => (
            <Link href={item.href} onClick={onNavigate} key={item.slug}>
              <small>{item.index}</small>
              <span>{item.shortLabel}</span>
            </Link>
          ))}
        </nav>

        <nav
          className="site-header__mobile-create-proofs"
          aria-label="Interactive concept demonstrations"
        >
          {CREATE_PROOF_DESTINATIONS.map((item) => (
            <Link href={item.href} onClick={onNavigate} key={item.href}>
              <small>{item.index}</small>
              <span>{item.label} proof</span>
            </Link>
          ))}
        </nav>

        <div className="site-header__mobile-create-links">
          <Link
            href="/create"
            aria-current={pathname === "/create" ? "page" : undefined}
            onClick={onNavigate}
          >
            <span>Explore all creations</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="/contact?brief=create" onClick={onNavigate}>
            <span>Let kingXford build it</span>
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
      </div>
    </details>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const mobileMenuRef = useRef<HTMLDetailsElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [createOpenPath, setCreateOpenPath] = useState<string | null>(null);
  const isCreateOpen = createOpenPath === pathname;

  const closeCreateMenu = useCallback(() => {
    setCreateOpenPath(null);
  }, []);

  useEffect(() => {
    const updateHeader = () => setIsScrolled(window.scrollY > 16);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  useEffect(() => {
    if (mobileMenuRef.current) mobileMenuRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    if (!isCreateOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!createMenuRef.current?.contains(event.target as Node)) {
        closeCreateMenu();
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeCreateMenu();
      createTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCreateMenu, isCreateOpen]);

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
        data-create-open={isCreateOpen ? "true" : "false"}
      >
        <div className="site-header__inner">
          <Link
            className="site-header__brand"
            href="/"
            aria-label="kingXford & Co home"
          >
            <KingxfordLogo
              className="site-header__logo"
              decorative
            />
          </Link>

          <nav
            className="site-header__desktop-nav"
            aria-label="Primary navigation"
          >
            <NavigationLinks items={navigationBeforeCreate} pathname={pathname} />
            <CreateDesktopMenu
              pathname={pathname}
              isOpen={isCreateOpen}
              onClose={closeCreateMenu}
              onToggle={() => {
                setCreateOpenPath((current) =>
                  current === pathname ? null : pathname,
                );
              }}
              menuRef={createMenuRef}
              triggerRef={createTriggerRef}
            />
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
                  items={navigationBeforeCreate}
                  pathname={pathname}
                  onNavigate={closeMobileMenu}
                />
                <CreateMobileMenu pathname={pathname} onNavigate={closeMobileMenu} />
              </nav>
              <p className="site-header__mobile-note">
                Intelligence, research and development, and responsible AI for
                people and institutions preparing for sustainable abundance.
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
