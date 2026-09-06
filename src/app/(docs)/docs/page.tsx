import type { Metadata } from "next";
import Link from "next/link";
import { DocArticle } from "@/components/layout/DocArticle";
import { DocHeading } from "@/components/layout/DocHeading";
import { Markdown } from "@/components/markdown/Markdown";
import { getAllDocs, getDocCategories, getOverviewDoc } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Overview of the Deligo backend engineering documentation set — architecture, modules, API, data model and operations.",
};

export default function DocsOverviewPage() {
  const overview = getOverviewDoc();
  const categories = getDocCategories();
  const isEmpty = getAllDocs().length === 0 && !overview;

  if (isEmpty) {
    return (
      <DocArticle>
        <DocHeading crumbs={[{ label: "Docs" }]} title="Documentation" />
        <p className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-fg-subtle">
          No documents yet. Add Markdown files under{" "}
          <code className="rounded bg-bg-inset px-1 py-0.5">content/docs/</code>{" "}
          — folders become sections and files become pages automatically.
        </p>
      </DocArticle>
    );
  }

  return (
    <DocArticle toc={overview?.toc ?? []}>
      {/* Description omitted: the overview README is rendered in full below. */}
      <DocHeading
        crumbs={[{ label: "Docs" }]}
        title={overview?.title ?? "Documentation"}
      />

      <section className="stagger mb-12 grid gap-3 sm:grid-cols-2">
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            href={cat.docs[0]?.href ?? "/docs"}
            className="group rounded-xl border border-border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-fg group-hover:text-accent">
                {cat.label}
              </h3>
              <span className="shrink-0 text-[0.6875rem] tabular-nums text-fg-subtle">
                {cat.docs.length} doc{cat.docs.length === 1 ? "" : "s"}
              </span>
            </div>
            {cat.docs[0]?.description && (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-fg-muted">
                {cat.docs[0].description}
              </p>
            )}
          </Link>
        ))}
      </section>

      {overview && (
        <Markdown content={overview.content} currentSlug={["readme"]} />
      )}
    </DocArticle>
  );
}
