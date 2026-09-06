"use client";

import { useSearch } from "@/components/search/SearchProvider";
import { useHydrated } from "@/lib/use-hydrated";

export function HomeSearch() {
  const { open } = useSearch();
  const hydrated = useHydrated();
  const isMac = !hydrated || /mac|iphone|ipad|ipod/i.test(navigator.platform);

  return (
    <button
      type="button"
      onClick={open}
      className="group flex w-full max-w-lg items-center gap-3 rounded-xl border border-border bg-bg-elevated px-4 py-3 text-left text-sm text-fg-subtle transition-all duration-200 hover:border-border-strong hover:shadow-card"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-colors group-hover:text-fg-muted" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span className="flex-1 transition-colors group-hover:text-fg-muted">
        Search the documentation…
      </span>
      <kbd className="hidden shrink-0 rounded border border-border bg-bg-subtle px-1.5 py-0.5 font-sans text-[0.6875rem] group-hover:border-border-strong sm:block">
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}
