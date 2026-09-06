import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import type { DocCommit, DocContent, DocMeta } from "@/types";
import { getDocsContentDir } from "./config";
import { getFileHistory, getLastCommit, getLastModified } from "./git";
import { extractToc, firstParagraph, getTitle, stripTitle } from "./markdown";
import { humanizeSlug, numericPrefix } from "./format";

const IGNORED_DIRS = new Set([".git", "node_modules", ".github", ".vscode"]);

/** Root-level file (any case) rendered as the `/docs` landing page, not a page of its own. */
const OVERVIEW_BASENAMES = new Set(["readme.md", "index.md"]);

const MD_RE = /\.mdx?$/i;

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

function walk(dir: string, root: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      walk(abs, root, acc);
    } else if (entry.isFile() && MD_RE.test(entry.name)) {
      acc.push(path.relative(root, abs).split(path.sep).join("/"));
    }
  }
}

/** "03-modules/cart-checkout-order.md" -> ["03-modules", "cart-checkout-order"] */
function relPathToSlug(relPath: string): string[] {
  return relPath
    .replace(MD_RE, "")
    .split("/")
    .map((seg) => seg.toLowerCase());
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function buildDoc(relPath: string, root: string): DocContent {
  const filePath = path.join(root, relPath);
  const raw = fs.readFileSync(filePath, "utf8");
  const { data: frontmatter, content: withoutFrontmatter } = matter(raw);

  const segments = relPath.split("/");
  const fileName = segments[segments.length - 1];
  const dirSlug = segments.length > 1 ? segments[0] : "";

  const slug = relPathToSlug(relPath);
  const body = stripTitle(withoutFrontmatter);

  const title =
    asString(frontmatter.title) ??
    getTitle(withoutFrontmatter) ??
    humanizeSlug(fileName.replace(MD_RE, ""));

  const categoryLabel =
    asString(frontmatter.category) ??
    (dirSlug ? humanizeSlug(dirSlug) || dirSlug : "General");

  const { date, source } = getLastModified(filePath);

  return {
    slug,
    href: `/docs/${slug.join("/")}`,
    title,
    category: categoryLabel,
    categorySlug: dirSlug || "general",
    order: asNumber(frontmatter.order) ?? numericPrefix(fileName),
    filePath,
    relPath,
    type: "doc",
    lastModified: date,
    lastModifiedSource: source,
    lastCommit: getLastCommit(filePath),
    description:
      asString(frontmatter.description) ?? firstParagraph(body),
    frontmatter: frontmatter as Record<string, unknown>,
    content: body,
    toc: extractToc(body),
  };
}

function isDraft(fm: Record<string, unknown>): boolean {
  return fm.draft === true || fm.published === false;
}

// ---------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------

interface DocsIndex {
  contentDir: string;
  all: DocContent[];
  bySlug: Map<string, DocContent>;
  overviewRelPath: string | null;
  /** Whether the `content/docs` directory exists. */
  available: boolean;
}

function categoryOrder(categorySlug: string): number {
  return numericPrefix(categorySlug, 900);
}

const loadIndex = cache((): DocsIndex => {
  const contentDir = getDocsContentDir();
  const empty: DocsIndex = {
    contentDir,
    all: [],
    bySlug: new Map(),
    overviewRelPath: null,
    available: false,
  };

  try {
    if (!fs.statSync(contentDir).isDirectory()) return empty;
  } catch {
    return empty;
  }

  const relPaths: string[] = [];
  walk(contentDir, contentDir, relPaths);

  const overviewRelPath =
    relPaths.find((rp) => OVERVIEW_BASENAMES.has(rp.toLowerCase())) ?? null;

  const all = relPaths
    .filter((rp) => rp !== overviewRelPath)
    .map((rp) => buildDoc(rp, contentDir))
    .filter((doc) => !isDraft(doc.frontmatter))
    .sort((a, b) => {
      const cat = categoryOrder(a.categorySlug) - categoryOrder(b.categorySlug);
      if (cat !== 0) return cat;
      if (a.order !== b.order) return a.order - b.order;
      return a.title.localeCompare(b.title);
    });

  const bySlug = new Map<string, DocContent>();
  for (const doc of all) bySlug.set(doc.slug.join("/"), doc);

  return { contentDir, all, bySlug, overviewRelPath, available: true };
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Whether the `content/docs` directory exists (it may still hold zero files). */
export function docsAvailable(): boolean {
  return loadIndex().available;
}

/** Absolute path the content is read from — for empty-state messaging only. */
export function getDocsContentRoot(): string {
  return loadIndex().contentDir;
}

/** All doc pages, ordered for navigation. */
export function getAllDocs(): DocMeta[] {
  return loadIndex().all.map(stripContent);
}

/** Full content for every doc — used by the search index builder. */
export function getAllDocContents(): DocContent[] {
  return loadIndex().all;
}

export function getDoc(slug: string[]): DocContent | null {
  return loadIndex().bySlug.get(slug.join("/")) ?? null;
}

/** The `content/docs` README / index, rendered as the `/docs` landing page. */
export const getOverviewDoc = cache((): DocContent | null => {
  const { contentDir, overviewRelPath } = loadIndex();
  if (!overviewRelPath) return null;
  return buildDoc(overviewRelPath, contentDir);
});

export interface DocCategory {
  slug: string;
  label: string;
  order: number;
  docs: DocMeta[];
}

export function getCategoryBySlug(slug: string): DocCategory | null {
  return getDocCategories().find((c) => c.slug === slug) ?? null;
}

/** Docs grouped by their folder, in navigation order. */
export function getDocCategories(): DocCategory[] {
  const { all } = loadIndex();
  const map = new Map<string, DocCategory>();
  for (const doc of all) {
    let group = map.get(doc.categorySlug);
    if (!group) {
      group = {
        slug: doc.categorySlug,
        label: doc.category,
        order: categoryOrder(doc.categorySlug),
        docs: [],
      };
      map.set(doc.categorySlug, group);
    }
    group.docs.push(stripContent(doc));
  }
  return [...map.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

/**
 * Docs ordered by last-modified date, newest first. Prefers git-committed
 * dates; falls back to filesystem mtimes only when no doc has a git date at
 * all (e.g. content not yet committed).
 */
export function getRecentlyUpdatedDocs(limit = 6): DocMeta[] {
  const dated = getAllDocs().filter((d) => d.lastModified);
  const gitDated = dated.filter((d) => d.lastModifiedSource === "git");
  const pool = gitDated.length > 0 ? gitDated : dated;
  return pool
    .sort(
      (a, b) =>
        new Date(b.lastModified!).getTime() - new Date(a.lastModified!).getTime(),
    )
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Git history (data model for a future "View changes" feature)
// ---------------------------------------------------------------------------

/** Commit history for one document, newest first. Empty when unavailable. */
export function getDocHistory(slug: string[], limit = 20): DocCommit[] {
  const doc = getDoc(slug);
  return doc ? getFileHistory(doc.filePath, limit) : [];
}

export { getChangedDocPaths } from "./git";

// ---------------------------------------------------------------------------

function stripContent(doc: DocContent): DocMeta {
  const { content: _content, toc: _toc, ...meta } = doc;
  void _content;
  void _toc;
  return meta;
}
