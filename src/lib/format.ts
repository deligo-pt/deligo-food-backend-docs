/** Small pure formatting helpers, safe to use on the server and the client. */

/** Parse a leading numeric prefix like "03-modules" -> 3. Returns `fallback` when absent. */
export function numericPrefix(name: string, fallback = 999): number {
  const m = /^(\d+)/.exec(name);
  return m ? Number.parseInt(m[1], 10) : fallback;
}

/** "03-modules" -> "Modules"; "known-gaps" -> "Known Gaps". */
export function humanizeSlug(slug: string): string {
  return slug
    .replace(/^\d+[-_]/, "")
    .replace(/\.md$/i, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** "03-modules" -> "03 — Modules" using a provided label. */
export function sectionLabel(categorySlug: string, label: string): string {
  const m = /^(\d+)/.exec(categorySlug);
  return m ? `${m[1]} — ${label}` : label;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  doc: "Doc",
  overview: "Overview",
  changelog: "Change",
  "decision-log": "Decision",
};

/** Short badge label for a search record's `type`. Unknown types are humanised. */
export function docTypeLabel(type: string): string {
  return DOC_TYPE_LABELS[type] ?? (humanizeSlug(type) || "Doc");
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** ISO string -> "30 August 2026". Returns null for empty / invalid input. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return DATE_FMT.format(d);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "08" or 8 -> "August". */
export function monthName(month: string | number): string {
  const n = typeof month === "string" ? Number.parseInt(month, 10) : month;
  return MONTHS[n - 1] ?? String(month);
}

export { MONTHS };
