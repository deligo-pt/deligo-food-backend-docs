/**
 * Resolve a link that appears inside a markdown document to a route in this
 * site, so cross-references between docs keep working.
 */

export interface ResolvedLink {
  href: string;
  external: boolean;
}

const EXTERNAL_RE = /^(https?:)?\/\//i;
const ABSOLUTE_SRC_RE = /^(https?:)?\/\/|^\/|^#|^mailto:|^tel:/i;

/**
 * URL schemes that must never reach the DOM as an `href`/`src`. `rehype-sanitize`
 * already strips these in the Markdown pipeline (see `Markdown.tsx`); this is a
 * second, independent check at render time so a future pipeline change cannot
 * silently re-open the hole.
 */
const DANGEROUS_SCHEMES = new Set([
  "javascript",
  "vbscript",
  "data",
  "blob",
  "file",
]);

function isDangerousUrl(raw: string): boolean {
  // Read the scheme ([a-z][a-z0-9+.-]* up to the first ":"), tolerating any
  // leading whitespace a browser would ignore. Values reaching here have
  // already been HTML-entity-decoded by the Markdown parser.
  const match = /^\s*([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(raw);
  return match !== null && DANGEROUS_SCHEMES.has(match[1].toLowerCase());
}

/**
 * Resolve an image `src` that appears inside a document.
 *
 * A dangerous scheme (`javascript:`, `data:`, `blob:`, …) is dropped. Absolute
 * `http(s)` URLs and root-absolute paths are returned unchanged. A relative
 * reference (`./diagram.png`, `../assets/x.svg`) is resolved against the current
 * document's folder and rewritten to `/docs-assets/<path>`, which streams the
 * co-located file from `content/docs/` (auth-gated like everything else). This
 * is what lets a doc drop an image next to its Markdown and have it just work.
 */
export function resolveAssetSrc(
  rawSrc: string | undefined,
  currentSlug: string[],
): string {
  const src = (rawSrc ?? "").trim();
  if (!src || isDangerousUrl(src)) return "";
  if (ABSOLUTE_SRC_RE.test(src)) return src;

  const dir = currentSlug.slice(0, -1);
  const stack = [...dir];
  for (const part of src.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  const resolved = stack.filter(Boolean).join("/");
  return resolved ? `/docs-assets/${resolved}` : src;
}

export function resolveDocLink(
  rawHref: string | undefined,
  currentSlug: string[],
): ResolvedLink {
  const href = (rawHref ?? "").trim();

  if (!href) return { href: "#", external: false };
  if (isDangerousUrl(href)) return { href: "#", external: false };
  if (EXTERNAL_RE.test(href) || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return { href, external: true };
  }
  if (href.startsWith("#")) return { href, external: false };
  if (href.startsWith("/")) return { href, external: false };

  // Relative reference, usually to another markdown file.
  const [pathPart, hash = ""] = href.split("#");
  const anchor = hash ? `#${hash}` : "";

  if (!/\.mdx?($|[#?])/i.test(pathPart) && !pathPart.includes("/") && !pathPart.startsWith(".")) {
    // Not obviously a doc link (e.g. a bare word) — leave as-is.
    return { href, external: false };
  }

  const dir = currentSlug.slice(0, -1);
  const stack = [...dir];

  for (const part of pathPart.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      stack.pop();
      continue;
    }
    stack.push(part.replace(/\.mdx?$/i, "").toLowerCase());
  }

  const resolved = stack.join("/");

  if (resolved === "readme" || resolved === "") return { href: `/docs${anchor}`, external: false };
  if (resolved === "09-change-log/readme") return { href: `/changelog${anchor}`, external: false };
  if (resolved === "10-decision-log/readme") return { href: `/decisions${anchor}`, external: false };

  return { href: `/docs/${resolved}${anchor}`, external: false };
}
