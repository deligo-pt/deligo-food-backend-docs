import type { Metadata } from "next";
import { DocHeading } from "@/components/layout/DocHeading";
import { FilterBar, type SelectFilter } from "@/components/changelog/FilterBar";
import { ChangelogEntryCard } from "@/components/changelog/ChangelogEntryCard";
import {
  getChangelogEntries,
  getChangelogFacets,
  groupByMonth,
} from "@/lib/changelog";
import { dotClassForType } from "@/components/ui/Badge";
import { firstParam } from "@/lib/query";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Change Log",
  description:
    "Notable changes to the Deligo backend — features, fixes and breaking changes — with date, module, type and status filters.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const values = {
    year: firstParam(sp.year),
    month: firstParam(sp.month),
    module: firstParam(sp.module),
    type: firstParam(sp.type),
    status: firstParam(sp.status),
  };

  const entries = getChangelogEntries();
  const facets = getChangelogFacets(entries);

  const filtered = entries.filter((e) => {
    if (values.year && e.year !== values.year) return false;
    if (values.month && e.month !== values.month) return false;
    if (values.module && !e.modules.includes(values.module)) return false;
    if (values.type && e.type !== values.type) return false;
    if (values.status && e.status !== values.status) return false;
    return true;
  });

  const groups = groupByMonth(filtered);
  const filterKey = Object.values(values).join("|");

  const filters: SelectFilter[] = [
    { key: "year", label: "Year", allLabel: "All Years", options: facets.years.map((y) => ({ value: y, label: y })) },
    { key: "month", label: "Month", allLabel: "All Months", options: facets.months },
    { key: "module", label: "Module", allLabel: "All Modules", options: facets.modules.map((m) => ({ value: m, label: m })) },
    { key: "type", label: "Type", allLabel: "All Types", options: facets.types.map((t) => ({ value: t, label: t })) },
    { key: "status", label: "Status", allLabel: "All Statuses", options: facets.statuses.map((s) => ({ value: s, label: s })) },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-9 sm:px-8 xl:py-12">
      <div className="w-full max-w-180 min-w-0">
        <DocHeading
          crumbs={[{ label: "Docs", href: "/docs" }, { label: "Change Log" }]}
          title="Change Log"
          description="Notable backend changes, newest first. Git history stays the source of truth for exactly what changed; this log captures the why. Filter state is kept in the URL, so a filtered view can be shared."
        />

        {entries.length === 0 ? (
          <EmptyState>
            No change-log entries yet. Add them to content/changelog.md.
          </EmptyState>
        ) : (
          <>
            <FilterBar
              filters={filters}
              values={values}
              basePath="/changelog"
              resultCount={filtered.length}
              totalCount={entries.length}
              noun="entries"
            />

            {filtered.length === 0 ? (
              <EmptyState>No entries match the selected filters.</EmptyState>
            ) : (
              <div key={filterKey} className="animate-fade-in mt-4 space-y-10">
                {groups.map((group) => (
                  <section key={group.key}>
                    <h2 className="flex items-center gap-3 text-[0.8125rem] font-semibold tracking-wide text-fg-muted">
                      <span className="rounded-md border border-border bg-bg-subtle px-2 py-0.5">
                        {group.label}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-xs font-normal tabular-nums text-fg-subtle">
                        {group.entries.length}
                      </span>
                    </h2>

                    <ol className="mt-4 ml-1.75 divide-y divide-border/70 border-l border-border">
                      {group.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="relative py-6 pl-7 first:pt-3 last:pb-1"
                        >
                          <span
                            className={cn(
                              "absolute top-7 left-0 size-2.5 -translate-x-1/2 rounded-full ring-4 ring-bg",
                              dotClassForType(entry.type),
                            )}
                            aria-hidden
                          />
                          <ChangelogEntryCard entry={entry} />
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-fg-subtle">
      {children}
    </p>
  );
}
