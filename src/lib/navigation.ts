import "server-only";
import { cache } from "react";
import type { NavSection } from "@/types";
import { getDocCategories, getOverviewDoc } from "./docs";
import { sectionLabel } from "./format";
import { SPECIAL_ROUTES } from "./config";

/**
 * The documentation sidebar, generated from the folder structure under
 * `content/docs` — one section per top-level folder — with the Change Log and
 * Decision Log pinned last, pointing at their dedicated routes.
 */
export const getNavigation = cache((): NavSection[] => {
  const sections: NavSection[] = [];

  if (getOverviewDoc()) {
    sections.push({
      title: "Introduction",
      order: -1,
      items: [{ title: "Overview", href: "/docs" }],
    });
  }

  for (const cat of getDocCategories()) {
    sections.push({
      title: sectionLabel(cat.slug, cat.label),
      order: cat.order,
      items: cat.docs.map((doc) => ({ title: doc.title, href: doc.href })),
    });
  }

  // App features, not doc folders — always present, served from their own routes.
  sections.push({
    title: "Change Log",
    href: SPECIAL_ROUTES.changelog,
    order: 9998,
    items: [],
  });
  sections.push({
    title: "Decision Log",
    href: SPECIAL_ROUTES.decisions,
    order: 9999,
    items: [],
  });

  return sections.sort((a, b) => a.order - b.order);
});
