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

const navigationBeforeCreate = [
  { href: "/#mission", label: "Mission" },
  { href: "/lab", label: "R&D / Lab" },
] as const;

const navigationAfterCreate = [
  { href: "/work", label: "Work" },
  { href: "/media", label: "Media" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
] as const;

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

const createProofs = [
  { href: "/create/lumen-vale-laboratory", label: "Science", index: "01" },
  { href: "/create/meridian-financial-office", label: "Finance", index: "02" },
  { href: "/create/commonfield-institute", label: "Education", index: "03" },
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
          aria-label="Create workspace and demonstrations"
        >
          <header className="site-header__create-panel-topline">
            <span>Create system · Think / Test / Build</span>
            <span className="site-header__create-live">
              <i aria-hidden="true" /> Canvas available
            </span>
          </header>

          <div className="site-header__create-panel-grid">
            <div className="site-header__create-intro">
              <span className="site-header__create-kicker">One creation environment</span>
              <h2>From first thought to working proof.</h2>
              <p>
                Begin in the live workspace, examine complete concept systems,
                or move a serious idea into a Kingxford build plan.
              </p>
              <ol aria-label="Create process">
                <li><span>01</span> Think</li>
                <li><span>02</span> Test</li>
                <li><span>03</span> Build</li>
              </ol>
              <Link href="/create" onClick={onClose}>
                Explore the full Create system
                <ArrowUpRight aria-hidden="true" />
              </Link>
            </div>

            <Link
              className="site-header__create-canvas"
              href="/create/workspace"
              onClick={onClose}
            >
              <span className="site-header__create-canvas-label">
                <Sparkles aria-hidden="true" /> Flagship workspace
              </span>
              <strong>Open Canvas</strong>
              <p>
                Work with any creative input on the left. Inspect the live result
                and rigorous Agent review on the right.
              </p>
              <span className="site-header__create-canvas-panes" aria-hidden="true">
                <i><b>Input</b><em>Idea · Code · Map</em></i>
                <i><b>Live</b><em>Preview · Review</em></i>
              </span>
              <span className="site-header__create-canvas-cta">
                Enter the workspace <ArrowUpRight aria-hidden="true" />
              </span>
            </Link>

            <div className="site-header__create-start">
              <div>
                <span>Launch directly</span>
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
              <span>Explore working proofs</span>
              {createProofs.map((item) => (
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
          <small>Canvas · Prototypes · Build</small>
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
          <span><Sparkles aria-hidden="true" /> Flagship workspace</span>
          <strong>Open Canvas</strong>
          <small>Input left · Live result right · Agent on request</small>
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
            <NavigationLinks items={navigationAfterCreate} pathname={pathname} />
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
                <NavigationLinks
                  items={navigationAfterCreate}
                  pathname={pathname}
                  onNavigate={closeMobileMenu}
                />
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
