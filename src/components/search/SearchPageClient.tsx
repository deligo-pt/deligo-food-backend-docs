"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SearchRecord } from "@/types";
import {
  highlightSegments,
  searchRecords,
  type SearchHit,
} from "@/lib/search-client";
import { docTypeLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

export function SearchPageClient() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [records, setRecords] = useState<SearchRecord[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/search-index", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setRecords(data as SearchRecord[]);
      })
      .catch(() => setRecords([]));
    inputRef.current?.focus();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reflect the query in the URL without a navigation (keeps it shareable,
  // doesn't re-run the server component on every keystroke).
  useEffect(() => {
    const t = setTimeout(() => {
      const q = query.trim();
      const url = q
        ? `${window.location.pathname}?q=${encodeURIComponent(q)}`
        : window.location.pathname;
      window.history.replaceState(null, "", url);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const hits = useMemo<SearchHit[]>(() => {
    if (!records || query.trim().length < 2) return [];
    return searchRecords(records, query, 60);
  }, [records, query]);

  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated px-4 transition-colors focus-within:border-accent-border focus-within:ring-2 focus-within:ring-(--ring)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-fg-subtle" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles, headings and content…"
          className="h-12 flex-1 bg-transparent text-sm text-fg [outline:none]! placeholder:text-fg-subtle"
          spellCheck={false}
          autoComplete="off"
          aria-label="Search query"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="shrink-0 rounded p-1 text-fg-subtle transition-colors hover:text-fg"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-6">
        {records === null && (
          <p className="text-sm text-fg-subtle">Loading search index…</p>
        )}

        {records !== null && query.trim().length < 2 && (
          <p className="text-sm text-fg-subtle">
            Type at least two characters to search {records.length} documents,
            change-log entries and decisions.
          </p>
        )}

        {records !== null && query.trim().length >= 2 && (
          <p className="mb-4 text-xs tabular-nums text-fg-subtle">
            {hits.length} result{hits.length === 1 ? "" : "s"} for{" "}
            <span className="text-fg-muted">“{query.trim()}”</span>
          </p>
        )}

        <ul className="flex flex-col gap-1">
          {hits.map((hit) => (
            <li key={hit.record.id}>
              <Link
                href={hit.record.href}
                className="group block rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-bg-subtle"
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide uppercase",
                      hit.record.type === "changelog"
                        ? "bg-accent-subtle text-accent"
                        : hit.record.type === "decision-log"
                          ? "bg-info-subtle text-info"
                          : "bg-bg-inset text-fg-subtle",
                    )}
                  >
                    {docTypeLabel(hit.record.type)}
                  </span>
                  <span className="text-sm font-medium text-fg group-hover:text-accent">
                    {hit.record.title}
                  </span>
                  <span className="text-[0.6875rem] text-fg-subtle">
                    {hit.record.category}
                    {hit.section && hit.section !== hit.record.title
                      ? ` · ${hit.section}`
                      : ""}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-fg-muted">
                  {highlightSegments(hit.excerpt, hit.terms).map((seg, j) =>
                    j % 2 === 1 ? (
                      <mark key={j}>{seg}</mark>
                    ) : (
                      <span key={j}>{seg}</span>
                    ),
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        {records !== null && query.trim().length >= 2 && hits.length === 0 && (
          <p className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-fg-subtle">
            No results for{" "}
            <span className="text-fg">“{query.trim()}”</span>.
          </p>
        )}
      </div>
    </div>
  );
}
