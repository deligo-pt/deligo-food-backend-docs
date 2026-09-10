import type { SearchRecord } from "@/types";

export interface SearchHit {
  record: SearchRecord;
  score: number;
  /** Best-matching heading for the query, if any. */
  section: string | null;
  /** Plain-text excerpt around the first match. */
  excerpt: string;
  /** Query terms, lower-cased — for highlighting. */
  terms: string[];
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function buildExcerpt(content: string, terms: string[], radius = 90): string {
  const lower = content.toLowerCase();
  let pos = -1;
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  if (pos === -1) return content.slice(0, radius * 2).trim();
  const start = Math.max(0, pos - radius);
  const end = Math.min(content.length, pos + radius);
  let slice = content.slice(start, end).trim();
  if (start > 0) slice = `… ${slice}`;
  if (end < content.length) slice = `${slice} …`;
  return slice;
}

/**
 * Rank documentation records against a free-text query.
 *
 * All terms must appear somewhere in a record (AND). Matches in the title and
 * headings are weighted more heavily than body matches.
 */
export function searchRecords(
  records: SearchRecord[],
  query: string,
  limit = 40,
): SearchHit[] {
  const terms = tokenize(query);
  if (terms.length === 0) return [];

  const hits: SearchHit[] = [];

  for (const record of records) {
    const title = record.title.toLowerCase();
    const headings = record.headings.map((h) => h.toLowerCase());
    const content = record.content.toLowerCase();

    let score = 0;
    let matchedAll = true;

    for (const term of terms) {
      const inTitle = title.includes(term);
      const inHeading = headings.some((h) => h.includes(term));
      const inContent = content.includes(term);

      if (!inTitle && !inHeading && !inContent) {
        matchedAll = false;
        break;
      }
      if (inTitle) score += title === term ? 24 : 12;
      if (inHeading) score += 5;
      if (inContent) score += 1;
    }

    if (!matchedAll) continue;

    // Phrase bonus.
    if (terms.length > 1) {
      const phrase = terms.join(" ");
      if (title.includes(phrase)) score += 16;
      else if (content.includes(phrase)) score += 6;
    }

    const section =
      record.headings.find((h) =>
        terms.some((t) => h.toLowerCase().includes(t)),
      ) ?? null;

    hits.push({
      record,
      score,
      section,
      excerpt: buildExcerpt(record.content, terms),
      terms,
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Split a string into alternating [text, match, text, match, …] segments. */
export function highlightSegments(text: string, terms: string[]): string[] {
  if (terms.length === 0) return [text];
  const escaped = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter(Boolean);
  if (escaped.length === 0) return [text];
  const re = new RegExp(`(${escaped.join("|")})`, "ig");
  return text.split(re);
}
