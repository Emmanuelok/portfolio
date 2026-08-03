"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

type ThemeChoice = "light" | "dark" | "system";
type ResolvedTheme = Exclude<ThemeChoice, "system">;

const STORAGE_KEY = "kxco-theme";
const THEME_EVENT = "kxco-theme-change";

const themeOptions = [
  { value: "light" as const, label: "Light theme", icon: Sun },
  { value: "dark" as const, label: "Dark theme", icon: Moon },
  { value: "system" as const, label: "Use system theme", icon: Monitor },
];

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(choice: ThemeChoice) {
  const resolved = choice === "system" ? systemTheme() : choice;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themeChoice = choice;
  root.style.colorScheme = resolved;
}

function getThemeSnapshot(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const storedTheme = localStorage.getItem(STORAGE_KEY);
  return isThemeChoice(storedTheme) ? storedTheme : "system";
}

function getServerThemeSnapshot(): ThemeChoice {
  return "system";
}

function subscribeToTheme(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const handleStorage = (event: StorageEvent) => {
    if (!event.key || event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };
  const handleThemeEvent = () => onStoreChange();
  const handleSystemChange = () => {
    if (getThemeSnapshot() === "system") applyTheme("system");
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_EVENT, handleThemeEvent);
  media.addEventListener("change", handleSystemChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_EVENT, handleThemeEvent);
    media.removeEventListener("change", handleSystemChange);
  };
}

type ThemeControlsProps = Readonly<{
  className?: string;
  showLabels?: boolean;
}>;

export function ThemeControls({
  className,
  showLabels = false,
}: ThemeControlsProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const selectTheme = (choice: ThemeChoice) => {
    localStorage.setItem(STORAGE_KEY, choice);
    applyTheme(choice);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | undefined;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % themeOptions.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + themeOptions.length) % themeOptions.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = themeOptions.length - 1;
    }

    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextOption = themeOptions[nextIndex];
    selectTheme(nextOption.value);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className={
        className ? `theme-controls ${className}` : "theme-controls"
      }
      role="radiogroup"
      aria-label="Color theme"
    >
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isSelected = theme === option.value;

        return (
          <button
            ref={(element) => {
              optionRefs.current[themeOptions.indexOf(option)] = element;
            }}
            className="theme-controls__option"
            data-active={isSelected ? "true" : "false"}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            title={option.label}
            tabIndex={isSelected ? 0 : -1}
            key={option.value}
            onClick={() => selectTheme(option.value)}
            onKeyDown={(event) =>
              handleKeyDown(event, themeOptions.indexOf(option))
            }
          >
            <Icon aria-hidden="true" />
            {showLabels && <span>{option.value}</span>}
          </button>
        );
      })}
    </div>
  );
}
