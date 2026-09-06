import type { Metadata } from "next";
import { DocHeading } from "@/components/layout/DocHeading";
import { FilterBar, type SelectFilter } from "@/components/changelog/FilterBar";
import { DecisionCard } from "@/components/decisions/DecisionCard";
import { getDecisionFacets, getDecisions } from "@/lib/decisions";
import { firstParam } from "@/lib/query";

export const metadata: Metadata = {
  title: "Decision Log",
  description:
    "Architectural and business-rule decisions for the Deligo backend — context, alternatives considered and consequences.",
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const values = {
    year: firstParam(sp.year),
    status: firstParam(sp.status),
  };

  const decisions = getDecisions();
  const facets = getDecisionFacets(decisions);

  const filtered = decisions.filter((d) => {
    if (values.year && d.year !== values.year) return false;
    if (values.status && d.statusLabel !== values.status) return false;
    return true;
  });
  const filterKey = Object.values(values).join("|");

  const filters: SelectFilter[] = [
    { key: "year", label: "Year", allLabel: "All Years", options: facets.years.map((y) => ({ value: y, label: y })) },
    { key: "status", label: "Status", allLabel: "All Statuses", options: facets.statuses.map((s) => ({ value: s, label: s })) },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-9 sm:px-8 xl:py-12">
      <div className="w-full max-w-180 min-w-0">
        <DocHeading
          crumbs={[{ label: "Docs", href: "/docs" }, { label: "Decision Log" }]}
          title="Decision Log"
          description="Significant architectural and business-rule decisions — not just what was built, but why one approach was chosen over the alternatives."
        />

        {decisions.length === 0 ? (
          <EmptyState>
            No decision records yet. Add them to content/decisions.md.
          </EmptyState>
        ) : (
          <>
            <FilterBar
              filters={filters}
              values={values}
              basePath="/decisions"
              resultCount={filtered.length}
              totalCount={decisions.length}
              noun="decisions"
            />

            {filtered.length === 0 ? (
              <EmptyState>No decisions match the selected filters.</EmptyState>
            ) : (
              <div key={filterKey} className="animate-fade-in mt-6 space-y-10">
                {filtered.map((d) => (
                  <DecisionCard key={d.id} decision={d} />
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
