import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocArticle } from "@/components/layout/DocArticle";
import { DocHeading } from "@/components/layout/DocHeading";
import { DiffView } from "@/components/docs/DiffView";
import { getAllDocs, getDoc, getDocLatestDiff } from "@/lib/docs";

/**
 * "View changes" for a single documentation page: the most recent commit that
 * touched the file, diffed against that commit's parent.
 *
 * This is a sibling special route — the same shape the codebase already uses
 * for `/changelog` and `/decisions` — because the docs route (`/docs/[...slug]`)
 * is a catch-all and cannot host a nested static segment.
 *
 * Statically generated for every real doc slug, from the same build-time Git
 * data as the "Last updated" line, so the existing SSG architecture is
 * unchanged. `dynamicParams = false` makes unknown / category / draft slugs
 * 404, and `getDoc()` is the only lookup so drafts never resolve here.
 */
export const dynamicParams = false;

type Params = { slug: string[] };

export function generateStaticParams(): Params[] {
  return getAllDocs().map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  return { title: doc ? `Changes · ${doc.title}` : "Not found" };
}

export default async function DocChangesPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();

  const diff = getDocLatestDiff(slug);

  return (
    <DocArticle>
      <DocHeading
        crumbs={[
          { label: "Docs", href: "/docs" },
          { label: doc.category, href: `/docs/${doc.categorySlug}` },
          { label: doc.title, href: doc.href },
          { label: "Changes" },
        ]}
        title={`Changes to ${doc.title}`}
        description="The most recent committed change to this document, compared with its previous version."
      />

      {diff && diff.hunks.length > 0 ? (
        <DiffView diff={diff} />
      ) : (
        <p className="not-prose rounded-xl border border-dashed border-border py-14 text-center text-sm text-fg-subtle">
          {diff?.note ??
            "No committed changes are available for this document yet."}
        </p>
      )}

      <p className="mt-8 text-sm">
        <Link
          href={doc.href}
          className="text-accent transition-colors hover:underline"
        >
          ← Back to {doc.title}
        </Link>
      </p>
    </DocArticle>
  );
}
