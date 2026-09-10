"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

export interface SelectFilter {
  key: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
}


export function FilterBar({
  filters,
  values,
  basePath,
  resultCount,
  totalCount,
  noun,
}: {
  filters: SelectFilter[];
  values: Record<string, string>;
  basePath: string;
  resultCount: number;
  totalCount: number;
  noun: string;
}) {
  const router = useRouter();
  const activeFilters = filters.filter((f) => values[f.key]);

  const push = useCallback(
    (next: Record<string, string>) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) if (v) qs.set(k, v);
      const query = qs.toString();
      router.push(query ? `${basePath}?${query}` : basePath, { scroll: false });
    },
    [router, basePath],
  );

  const labelFor = (filter: SelectFilter, value: string) =>
    filter.options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="sticky top-14 z-30 -mx-4 mb-2 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur-md sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 pr-1 text-[0.6875rem] font-semibold tracking-[0.1em] text-fg-subtle uppercase">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          Filter
        </span>

        {filters.map((filter) => (
          <label key={filter.key} className="relative">
            <span className="sr-only">{filter.label}</span>
            <select
              value={values[filter.key] ?? ""}
              onChange={(e) => push({ ...values, [filter.key]: e.target.value })}
              className={cn(
                "h-8 cursor-pointer appearance-none rounded-lg border bg-bg-elevated py-0 pr-7 pl-3 text-[0.8125rem] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
                values[filter.key]
                  ? "border-accent-border font-medium text-accent"
                  : "border-border text-fg-muted hover:border-border-strong",
              )}
            >
              <option value="">{filter.allLabel}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-subtle"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </label>
        ))}

        <span className="ml-auto text-xs tabular-nums text-fg-subtle">
          {resultCount === totalCount
            ? `${totalCount} ${noun}`
            : `${resultCount} of ${totalCount} ${noun}`}
        </span>
      </div>

      {activeFilters.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => push({ ...values, [filter.key]: "" })}
              className="group inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-subtle py-0.5 pr-1.5 pl-2 text-[0.6875rem] font-medium text-accent transition-colors hover:border-accent"
            >
              <span className="text-fg-subtle">{filter.label}:</span>
              {labelFor(filter, values[filter.key])}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-60 group-hover:opacity-100" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          ))}
          <button
            type="button"
            onClick={() => push({})}
            className="ml-0.5 rounded-full px-2 py-0.5 text-[0.6875rem] text-fg-subtle transition-colors hover:text-fg"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
