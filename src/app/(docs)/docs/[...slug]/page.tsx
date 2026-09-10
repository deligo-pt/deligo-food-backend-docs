import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocArticle } from "@/components/layout/DocArticle";
import { DocHeading } from "@/components/layout/DocHeading";
import { PrevNext } from "@/components/layout/PrevNext";
import { Markdown } from "@/components/markdown/Markdown";
import {
  getAllDocs,
  getCategoryBySlug,
  getDoc,
  getDocCategories,
} from "@/lib/docs";
import { docChangesHref } from "@/lib/config";
import { sectionLabel } from "@/lib/format";

export const dynamicParams = false;

type Params = { slug: string[] };

export function generateStaticParams(): Params[] {
  const docs = getAllDocs().map((doc) => ({ slug: doc.slug }));
  const categories = getDocCategories().map((c) => ({ slug: [c.slug] }));
  return [...categories, ...docs];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (doc) return { title: doc.title, description: doc.description ?? undefined };

  if (slug.length === 1) {
    const category = getCategoryBySlug(slug[0]);
    if (category) return { title: category.label };
  }
  return { title: "Not found" };
}

export default async function DocPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const doc = getDoc(slug);

  if (!doc) {
    if (slug.length === 1) {
      const category = getCategoryBySlug(slug[0]);
      if (category) return <CategoryIndex slug={slug[0]} />;
    }
    notFound();
  }

  const all = getAllDocs();
  const index = all.findIndex((d) => d.slug.join("/") === doc.slug.join("/"));
  const prev = index > 0 ? all[index - 1] : null;
  const next = index >= 0 && index < all.length - 1 ? all[index + 1] : null;

  return (
    <DocArticle toc={doc.toc}>
      {/*
        No `description` here: it is `firstParagraph(doc.content)`, which the
        article below already renders verbatim — showing it twice reads as a
        glitch. The lead paragraph opens the article on its own.
      */}
      <DocHeading
        crumbs={[
          { label: "Docs", href: "/docs" },
          { label: doc.category, href: `/docs/${doc.categorySlug}` },
          { label: doc.title },
        ]}
        title={doc.title}
        meta={doc}
        changesHref={doc.lastCommit ? docChangesHref(doc.slug) : null}
      />
      <Markdown content={doc.content} currentSlug={doc.slug} />
      <PrevNext prev={prev} next={next} />
    </DocArticle>
  );
}

function CategoryIndex({ slug }: { slug: string }) {
  const category = getCategoryBySlug(slug)!;
  return (
    <DocArticle>
      <DocHeading
        crumbs={[{ label: "Docs", href: "/docs" }, { label: category.label }]}
        title={sectionLabel(category.slug, category.label)}
        description={`${category.docs.length} document${
          category.docs.length === 1 ? "" : "s"
        } in this section.`}
      />
      <ul className="stagger not-prose flex flex-col gap-2.5">
        {category.docs.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="group flex flex-col gap-1 rounded-xl border border-border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card"
            >
              <span className="text-sm font-medium text-fg group-hover:text-accent">
                {d.title}
              </span>
              {d.description && (
                <span className="line-clamp-2 text-xs leading-relaxed text-fg-muted">
                  {d.description}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </DocArticle>
  );
}
