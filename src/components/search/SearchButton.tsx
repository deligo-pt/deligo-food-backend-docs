"use client";

import { useSearch } from "./SearchProvider";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/cn";

export function SearchButton({ className }: { className?: string }) {
  const { open } = useSearch();
  const hydrated = useHydrated();
  const isMac = !hydrated || /mac|iphone|ipad|ipod/i.test(navigator.platform);

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "group flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-2.5 py-1.5 text-sm text-fg-subtle transition-colors hover:border-border-strong hover:text-fg-muted",
        className,
      )}
      aria-label="Search documentation"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <span className="hidden lg:inline">Search</span>
      <kbd className="ml-6 hidden shrink-0 items-center gap-0.5 rounded border border-border bg-bg-elevated px-1.5 py-0.5 font-sans text-[0.625rem] text-fg-subtle group-hover:border-border-strong lg:flex">
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}
