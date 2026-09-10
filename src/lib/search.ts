import "server-only";
import { cache } from "react";
import type { SearchRecord } from "@/types";
import { getAllDocContents, getOverviewDoc } from "./docs";
import { getChangelogEntries } from "./changelog";
import { getDecisions } from "./decisions";
import { allHeadings, toPlainText } from "./markdown";
import { SPECIAL_ROUTES } from "./config";

/**
 * Build the search index from every documentation source.
 *
 * This is deliberately a plain serialisable array so it can be:
 *   - served from an API route and filtered on the client (current approach), or
 *   - written to a static JSON file at build time, or
 *   - fed into a client-side index (Lunr / FlexSearch / MiniSearch) later
 * without touching how documents are loaded.
 */
export const buildSearchIndex = cache((): SearchRecord[] => {
  const records: SearchRecord[] = [];

  const overview = getOverviewDoc();
  if (overview) {
    records.push({
      id: "docs-overview",
      title: overview.title,
      href: "/docs",
      category: "Introduction",
      type: "overview",
      headings: allHeadings(overview.content),
      content: toPlainText(overview.content),
    });
  }

  for (const doc of getAllDocContents()) {
    records.push({
      id: doc.slug.join("/"),
      title: doc.title,
      href: doc.href,
      category: doc.category,
      type: doc.type,
      headings: allHeadings(doc.content),
      content: toPlainText(doc.content),
    });
  }

  for (const entry of getChangelogEntries()) {
    records.push({
      id: `changelog:${entry.id}`,
      title: entry.title,
      href: `${SPECIAL_ROUTES.changelog}#${entry.id}`,
      category: "Change Log",
      type: "changelog",
      headings: entry.modules,
      content: [
        entry.summary,
        entry.description,
        entry.technicalChanges.join(" "),
        entry.breakingChange,
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  for (const d of getDecisions()) {
    records.push({
      id: `decision:${d.id}`,
      title: d.title,
      href: `${SPECIAL_ROUTES.decisions}#${d.id}`,
      category: "Decision Log",
      type: "decision-log",
      headings: d.affectedModules,
      content: [d.context, d.problem, d.decision, d.reason, d.alternatives, d.consequences]
        .filter(Boolean)
        .join(" "),
    });
  }

  return records;
});
