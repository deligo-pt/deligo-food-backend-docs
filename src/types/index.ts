/**
 * Shared domain types for the Deligo documentation website.
 *
 * These describe the shape of documentation as this app models it — they are
 * derived from the source repository at read time and never persisted.
 */

/**
 * Coarse kind of a search/nav record. Real documents are just `"doc"` — their
 * category comes from the folder they live in, not from a fixed vocabulary.
 * The other members are the app's own special surfaces.
 */
export type DocType =
  | "doc"
  | "overview"
  | "changelog"
  | "decision-log"
  // Allow any string without losing autocomplete on the members above.
  | (string & {});

/** One git commit that touched a document. */
export interface DocCommit {
  hash: string;
  shortHash: string;
  /** Committer date, ISO 8601. */
  date: string;
  author: string;
  subject: string;
}

/** Lightweight metadata for a single documentation page. */
export interface DocMeta {
  /** URL-safe path segments, e.g. ["03-modules", "cart-checkout-order"]. */
  slug: string[];
  /** Route for this document, e.g. "/docs/03-modules/cart-checkout-order". */
  href: string;
  /** Human title — the document's first H1, or a humanised filename. */
  title: string;
  /** Category display label, e.g. "Modules". */
  category: string;
  /** Category directory name, e.g. "03-modules". */
  categorySlug: string;
  /** Numeric weight used for ordering (category prefix, else 999). */
  order: number;
  /** Absolute path on disk. Server-only. */
  filePath: string;
  /** Path relative to `content/docs`, e.g. "03-modules/cart-checkout-order.md". */
  relPath: string;
  type: DocType;
  /** ISO date string, or null when no reliable date could be determined. */
  lastModified: string | null;
  /** Where `lastModified` came from — never fabricated. */
  lastModifiedSource: "git" | "filesystem" | null;
  /** Most recent git commit that touched the file, when history is available. */
  lastCommit: DocCommit | null;
  /** First paragraph as plain text, for previews and meta descriptions. */
  description: string | null;
  /** Raw YAML frontmatter, if the file had any. Arbitrary keys are preserved. */
  frontmatter: Record<string, unknown>;
}

export interface TocItem {
  depth: number;
  text: string;
  id: string;
}

/** A documentation page plus its rendered-ready content. */
export interface DocContent extends DocMeta {
  /** Raw markdown with the leading H1 removed (title is rendered separately). */
  content: string;
  toc: TocItem[];
}

export interface NavLeaf {
  title: string;
  href: string;
  external?: boolean;
}

export interface NavSection {
  title: string;
  href?: string;
  order: number;
  items: NavLeaf[];
}

export interface ChangelogEntry {
  id: string;
  date: string;
  year: string;
  /** Zero-padded month number, e.g. "08". */
  month: string;
  /** Month name, e.g. "August". */
  monthName: string;
  title: string;
  modules: string[];
  type: string | null;
  /** Normalised short status, e.g. "Shipped". */
  status: string | null;
  /** One-line summary (the source "Title:" field). */
  summary: string | null;
  description: string | null;
  technicalChanges: string[];
  commit: string | null;
  pullRequest: string | null;
  /** Raw "Breaking Change:" text. */
  breakingChange: string | null;
  breaking: boolean;
  relatedDocs: string | null;
}

export interface Decision {
  id: string;
  date: string;
  year: string;
  title: string;
  status: string | null;
  /** Normalised short status, e.g. "Accepted", "Superseded". */
  statusLabel: string | null;
  context: string | null;
  problem: string | null;
  decision: string | null;
  reason: string | null;
  alternatives: string | null;
  consequences: string | null;
  affectedModules: string[];
  sourceReferences: string | null;
}

export interface SearchRecord {
  id: string;
  title: string;
  href: string;
  category: string;
  type: DocType;
  headings: string[];
  /** Plain-text body, whitespace-collapsed. */
  content: string;
}
