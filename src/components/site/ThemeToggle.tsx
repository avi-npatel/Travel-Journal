"use client";

import { useEffect } from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const currentTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

function savedTheme(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null; // storage can be blocked; the toggle still works for this visit
  }
}

/**
 * Switches between light and dark and remembers the choice. Which icon shows
 * is decided in CSS from data-theme, so the button needs no state and cannot
 * disagree with the page.
 */
export function ThemeToggle() {
  // Until a choice has been saved, keep following the system setting.
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (!savedTheme()) document.documentElement.dataset.theme = system.matches ? "dark" : "light";
    };
    system.addEventListener("change", follow);
    return () => system.removeEventListener("change", follow);
  }, []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // see savedTheme()
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      className="grid size-10 place-items-center rounded-full text-soft transition-colors hover:text-accent"
    >
      {/* Moon: shown in light mode */}
      <svg viewBox="0 0 24 24" className="size-[18px] dark:hidden" aria-hidden="true">
        <path
          d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      {/* Sun: shown in dark mode */}
      <svg viewBox="0 0 24 24" className="hidden size-[18px] dark:block" aria-hidden="true">
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
