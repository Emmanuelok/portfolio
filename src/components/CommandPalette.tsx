"use client";

import {
  ArrowUpRight,
  BriefcaseBusiness,
  FlaskConical,
  House,
  Mail,
  Newspaper,
  PanelsTopLeft,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CREATE_CATALOGUE_DESTINATIONS } from "@/lib/platform";

type CommandItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  keywords: string;
  icon: typeof House;
};

const commands: readonly CommandItem[] = [
  {
    id: "mission",
    label: "Mission",
    description: "Why Kingxford exists and how the platform works",
    href: "/#mission",
    keywords: "kingxford co mission research design responsible ai human capability complex problems ideas projects",
    icon: House,
  },
  {
    id: "lab",
    label: "Lab",
    description: "Research themes, experiments, and open questions",
    href: "/lab",
    keywords: "kingxford research development science academic experiments evidence responsible ai",
    icon: FlaskConical,
  },
  {
    id: "create",
    label: "Create",
    description: "Browse seven build categories, try three concept demos, or open Canvas",
    href: "/create",
    keywords: "create canvas studio websites digital tools platforms science laboratory finance education schools institutions businesses professionals individuals communities everyday needs",
    icon: PanelsTopLeft,
  },
  {
    id: "create-workspace",
    label: "Open Canvas",
    description: "Develop an idea, prototype, mind map, prompt, or brief",
    href: "/create/workspace?mode=idea",
    keywords: "canvas workspace creative tool idea concept code html css javascript mind map prompt brief live preview agent prototype build",
    icon: Sparkles,
  },
  ...CREATE_CATALOGUE_DESTINATIONS.map((item) => ({
    id: `create-category-${item.slug}`,
    label: item.label,
    description: item.description,
    href: item.href,
    keywords: `create catalogue ${item.keywords}`,
    icon: PanelsTopLeft,
  })),
  {
    id: "create-science",
    label: "Lumen Vale Laboratory",
    description: "Try the interactive science concept demo",
    href: "/create/lumen-vale-laboratory",
    keywords: "science laboratory research microscopy specimens observations interactive concept prototype",
    icon: FlaskConical,
  },
  {
    id: "create-finance",
    label: "Meridian Financial Office",
    description: "Try the interactive institutional finance concept demo",
    href: "/create/meridian-financial-office",
    keywords: "finance stewardship governance scenarios mandate committee interactive concept prototype",
    icon: BriefcaseBusiness,
  },
  {
    id: "create-education",
    label: "Commonfield Institute",
    description: "Try the interactive education concept demo",
    href: "/create/commonfield-institute",
    keywords: "education learning curriculum weekly syllabus school institute interactive concept prototype",
    icon: PanelsTopLeft,
  },
  {
    id: "work",
    label: "Work",
    description: "Read published case studies and inspect current outcomes",
    href: "/work",
    keywords: "portfolio published projects case studies evidence intelligence research deployed systems",
    icon: BriefcaseBusiness,
  },
  {
    id: "media",
    label: "Field notes",
    description: "Read research briefings and practical essays",
    href: "/media",
    keywords: "blog podcast media artificial intelligence sustainable abundance business finance design research",
    icon: Newspaper,
  },
  {
    id: "about",
    label: "About kingXford & Co",
    description: "Mission, working model, and capabilities",
    href: "/about",
    keywords: "company co mission investors contributors practice perspective capabilities",
    icon: UserRound,
  },
  {
    id: "contact",
    label: "Start a project",
    description: "Prepare a project brief or contact kingXford & Co",
    href: "/contact",
    keywords: "contact collaborate institution research development email project problem",
    icon: Mail,
  },
];

type CommandPaletteProps = Readonly<{
  showTrigger?: boolean;
  className?: string;
}>;

export function CommandPalette({
  showTrigger = true,
  className,
}: CommandPaletteProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    const needle = query.toLocaleLowerCase().trim();
    if (!needle) return commands;

    return commands.filter((command) =>
      `${command.label} ${command.description} ${command.keywords}`
        .toLocaleLowerCase()
        .includes(needle),
    );
  }, [query]);

  useEffect(() => {
    const openPalette = () => setIsOpen(true);
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.key.toLocaleLowerCase() === "k" &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setIsOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", handleShortcut);
    window.addEventListener("portfolio:command-open", openPalette);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("portfolio:command-open", openPalette);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => searchRef.current?.focus());
    }

    if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  };

  const goTo = (href: string) => {
    close();
    router.push(href);
  };

  const handleSearchKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (!filteredCommands.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filteredCommands.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) =>
          (current - 1 + filteredCommands.length) %
          filteredCommands.length,
      );
    }

    if (event.key === "Enter") {
      event.preventDefault();
      goTo(filteredCommands[activeIndex]?.href ?? filteredCommands[0].href);
    }
  };

  return (
    <>
      {showTrigger && (
        <button
          className={
            className
              ? `command-palette__trigger ${className}`
              : "command-palette__trigger"
          }
          type="button"
          onClick={() => setIsOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label="Open site command menu"
        >
          <Search aria-hidden="true" />
          <span>Explore</span>
          <kbd>
            <span aria-hidden="true">⌘</span>K
          </kbd>
        </button>
      )}

      <dialog
        ref={dialogRef}
        className="command-palette"
        aria-labelledby="command-palette-title"
        onClose={close}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="command-palette__panel">
          <div className="command-palette__heading">
            <div>
              <span className="command-palette__eyebrow">Quick navigation</span>
              <h2 id="command-palette-title">Choose a destination</h2>
            </div>
            <button
              className="command-palette__close"
              type="button"
              onClick={close}
              aria-label="Close command menu"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="command-palette__search">
            <Search aria-hidden="true" />
            <label className="sr-only" htmlFor="command-palette-search">
              Search pages
            </label>
            <input
              ref={searchRef}
              id="command-palette-search"
              type="search"
              placeholder="Search pages, projects, or topics…"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls="command-palette-results"
              aria-activedescendant={
                filteredCommands[activeIndex]
                  ? `command-${filteredCommands[activeIndex].id}`
                  : undefined
              }
            />
          </div>

          <div
            className="command-palette__results"
            id="command-palette-results"
            role="listbox"
            aria-label="Destinations"
          >
            {filteredCommands.map((command, index) => {
              const Icon = command.icon;
              const commandId = `command-${command.id}`;

              return (
                <button
                  id={commandId}
                  className="command-palette__item"
                  data-active={index === activeIndex ? "true" : "false"}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  key={command.href}
                  onPointerMove={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => goTo(command.href)}
                >
                  <span className="command-palette__item-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="command-palette__item-copy">
                    <strong>{command.label}</strong>
                    <small>{command.description}</small>
                  </span>
                  <ArrowUpRight aria-hidden="true" />
                </button>
              );
            })}

            {filteredCommands.length === 0 && (
              <p className="command-palette__empty">
                No destination found. Try “mission”, “create”, “lab”,
                “field notes”, or “contact”.
              </p>
            )}
          </div>

          <div className="command-palette__footer" aria-hidden="true">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> to navigate
            </span>
            <span>
              <kbd>↵</kbd> to open
            </span>
            <span>
              <kbd>esc</kbd> to close
            </span>
          </div>
        </div>
      </dialog>
    </>
  );
}
