"use client";

import {
  ArrowUpRight,
  BriefcaseBusiness,
  House,
  Mail,
  Search,
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

type CommandItem = {
  label: string;
  description: string;
  href: string;
  keywords: string;
  icon: typeof House;
};

const commands: readonly CommandItem[] = [
  {
    label: "Home",
    description: "Return to the opening experience",
    href: "/",
    keywords: "start index living loom",
    icon: House,
  },
  {
    label: "Selected work",
    description: "Explore digital products and visual systems",
    href: "/work",
    keywords: "portfolio projects case studies websites apps",
    icon: BriefcaseBusiness,
  },
  {
    label: "About Emmanuel",
    description: "Practice, perspective, and capabilities",
    href: "/about",
    keywords: "designer profile biography experience",
    icon: UserRound,
  },
  {
    label: "Start a conversation",
    description: "Bring an ambitious idea into focus",
    href: "/contact",
    keywords: "contact collaborate commission email project",
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
              <h2 id="command-palette-title">Where would you like to go?</h2>
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
              placeholder="Type a destination or idea…"
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
                  ? `command-${filteredCommands[activeIndex].href.replaceAll("/", "") || "home"}`
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
              const commandId = `command-${command.href.replaceAll("/", "") || "home"}`;

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
                No destination found. Try “work”, “about”, or “contact”.
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
