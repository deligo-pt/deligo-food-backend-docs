import { resolveDocLink } from "./links";
import { humanizeSlug } from "./format";

export interface RelatedLink {
  label: string;
  href: string;
}

// `path/to/doc.md`, ../path/doc.md, with or without surrounding backticks.
const TOKEN_RE = /`?((?:\.\.?\/)?[\w./-]+\.mdx?)`?/g;

/**
 * Turn a free-form "Related Documentation" string into resolved doc links plus
 * whatever descriptive note is left over. Only `.md` references are linked;
 * source-file paths (`src/...ts`) are left in the note text.
 */
export function parseRelatedDocs(
  raw: string | null | undefined,
  from: string[],
): { links: RelatedLink[]; note: string } {
  if (!raw) return { links: [], note: "" };

  const links: RelatedLink[] = [];
  const seen = new Set<string>();

  for (const match of raw.matchAll(TOKEN_RE)) {
    const token = match[1];
    const { href, external } = resolveDocLink(token, from);
    if (external || seen.has(href)) continue;
    seen.add(href);
    const base = token.split("/").pop()!.replace(/\.mdx?$/i, "");
    links.push({
      label: /^readme$/i.test(base) ? "Overview" : humanizeSlug(base),
      href,
    });
  }

  const note = raw
    .replace(TOKEN_RE, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:.–—-]+|[\s,;:–—-]+$/g, "")
    .trim();

  return { links, note };
}
