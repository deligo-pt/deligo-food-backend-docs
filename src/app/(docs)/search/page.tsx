import type { Metadata } from "next";
import { Suspense } from "react";
import { DocHeading } from "@/components/layout/DocHeading";
import { SearchPageClient } from "@/components/search/SearchPageClient";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Deligo engineering documentation.",
};

export default function SearchPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-9 sm:px-8 xl:py-12">
      <div className="w-full max-w-180 min-w-0">
        <DocHeading
          crumbs={[{ label: "Docs", href: "/docs" }, { label: "Search" }]}
          title="Search"
          description="Search across every document, change-log entry and decision record."
        />
        <Suspense
          fallback={<div className="h-12 rounded-xl border border-border" />}
        >
          <SearchPageClient />
        </Suspense>
      </div>
    </div>
  );
}
