"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { SearchRecord } from "@/types";
import {
  highlightSegments,
  searchRecords,
  type SearchHit,
} from "@/lib/search-client";
import { docTypeLabel } from "@/lib/format";
import { cn } from "@/lib/cn";

const TYPE_TONE: Record<string, string> = {
  changelog: "bg-accent-subtle text-accent",
  "decision-log": "bg-info-subtle text-info",
};

function TypeChip({ type }: { type: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[0.625rem] font-medium tracking-wide uppercase",
        TYPE_TONE[type] ?? "bg-bg-inset text-fg-subtle",
      )}
    >
      {docTypeLabel(type)}
    </span>
  );
}

/**
 * Rendered only while open (the parent gates it), so it always mounts with a
 * fresh empty query. Restores focus to the trigger on close.
 */
export function SearchDialog({
  onClose,
  records,
  loading,
}: {
  onClose: () => void;
  records: SearchRecord[] | null;
  loading: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const hits = useMemo<SearchHit[]>(() => {
    if (!records || query.trim().length < 2) return [];
    return searchRecords(records, query, 24);
  }, [records, query]);

  const suggestions = useMemo<SearchRecord[]>(() => {
    if (!records) return [];
    // One entry per distinct category, in index order — a quick map of what's here.
    const seen = new Set<string>();
    const out: SearchRecord[] = [];
    for (const r of records) {
      if (seen.has(r.category)) continue;
      seen.add(r.category);
      out.push(r);
      if (out.length >= 6) break;
    }
    return out;
  }, [records]);

  const showSuggestions = query.trim().length < 2;
  const rows = showSuggestions ? suggestions : hits.map((h) => h.record);
  const activeIndex = rows.length === 0 ? 0 : Math.min(active, rows.length - 1);

  // Focus the input on open; restore focus to the trigger on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = bodyOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const go = useCallback(
    (record: SearchRecord | undefined) => {
      if (!record) return;
      onClose();
      router.push(record.href);
    },
    [onClose, router],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive(() => Math.min(activeIndex + 1, rows.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(() => Math.max(activeIndex - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        go(rows[activeIndex]);
      } else if (e.key === "Tab") {
        // Simple focus trap.
        const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
          'input, button, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [rows, activeIndex, go, onClose],
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[10vh] sm:pt-[13vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
    >
      <div
        className="animate-fade-in absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="animate-scale-in shadow-float relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-bg-elevated"
        onKeyDown={onKeyDown}
      >
        <div className="border-b border-border p-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-border bg-bg px-3.5 transition-colors focus-within:border-accent-border focus-within:ring-2 focus-within:ring-(--ring)">
            <SearchIcon />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder="Search titles, headings and content…"
              className="h-11 flex-1 bg-transparent text-sm text-fg [outline:none]! placeholder:text-fg-subtle"
              autoComplete="off"
              spellCheck={false}
              aria-label="Search query"
            />
            <kbd className="hidden shrink-0 rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-[0.625rem] text-fg-subtle sm:block">
              ESC
            </kbd>
          </div>
        </div>

        <div className="max-h-[min(60vh,26rem)] overflow-y-auto custom-scroll">
          {loading && (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-fg-subtle">
              <Spinner />
              Loading search index…
            </div>
          )}

          {!loading && !records && (
            <p className="px-4 py-10 text-center text-sm text-fg-subtle">
              Search is unavailable right now.
            </p>
          )}

          {!loading && records && showSuggestions && (
            <div className="py-2">
              <p className="px-4 py-1.5 text-[0.6875rem] font-semibold tracking-[0.12em] text-fg-subtle uppercase">
                Suggested
              </p>
              <ul ref={listRef}>
                {suggestions.map((record, i) => (
                  <li key={record.id}>
                    <ResultButton
                      record={record}
                      active={i === activeIndex}
                      onHover={() => setActive(i)}
                      onSelect={() => go(record)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!loading && records && !showSuggestions && hits.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-fg-subtle">
              No results for <span className="text-fg">“{query.trim()}”</span>.
            </p>
          )}

          {!loading && records && !showSuggestions && hits.length > 0 && (
            <ul ref={listRef} className="py-1.5">
              {hits.map((hit, i) => (
                <li key={hit.record.id}>
                  <ResultButton
                    record={hit.record}
                    section={hit.section}
                    excerpt={hit.excerpt}
                    terms={hit.terms}
                    active={i === activeIndex}
                    onHover={() => setActive(i)}
                    onSelect={() => go(hit.record)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-bg-subtle px-4 py-2 text-[0.6875rem] text-fg-subtle">
          <span className="flex gap-3">
            <span className="flex items-center gap-1">
              <Key>↑</Key>
              <Key>↓</Key>
              <span className="ml-0.5">navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <Key>↵</Key>
              <span className="ml-0.5">open</span>
            </span>
          </span>
          <span>
            {!showSuggestions && hits.length
              ? `${hits.length} result${hits.length === 1 ? "" : "s"}`
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function ResultButton({
  record,
  section,
  excerpt,
  terms,
  active,
  onHover,
  onSelect,
}: {
  record: SearchRecord;
  section?: string | null;
  excerpt?: string;
  terms?: string[];
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col gap-1 px-4 py-2.5 text-left transition-colors",
        active ? "bg-accent-subtle" : "hover:bg-bg-subtle",
      )}
    >
      <span className="flex items-center gap-2">
        <TypeChip type={record.type} />
        <span className="truncate text-sm font-medium text-fg">
          {record.title}
        </span>
        <span className="ml-auto shrink-0 text-[0.6875rem] text-fg-subtle">
          {record.category}
          {section && section !== record.title ? ` · ${section}` : ""}
        </span>
      </span>
      {excerpt && (
        <span className="line-clamp-2 text-xs leading-relaxed text-fg-muted">
          {highlightSegments(excerpt, terms ?? []).map((seg, j) =>
            j % 2 === 1 ? <mark key={j}>{seg}</mark> : <span key={j}>{seg}</span>,
          )}
        </span>
      )}
    </button>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-bg-elevated px-1 py-0.5 font-sans text-[0.625rem]">
      {children}
    </kbd>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-fg-subtle" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin text-fg-subtle" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
