import "server-only";
import fs from "node:fs";
import { cache } from "react";
import type { ChangelogEntry } from "@/types";
import { getChangelogFile } from "./config";
import { monthName } from "./format";

const FIELD_LABELS = [
  "Module",
  "Type",
  "Status",
  "Title",
  "Description",
  "Technical Changes",
  "Commit",
  "Pull Request",
  "Breaking Change",
  "Related Documentation",
] as const;

const LABEL_RE = new RegExp(`^(${FIELD_LABELS.join("|")}):\\s?(.*)$`);
const HEADER_RE = /^(\d{4})-(\d{2})-(\d{2})\s+[—-]\s+(.+)$/;

/** Grab the body between `## Entries` and the next `## ` heading. */
function entriesBlock(markdown: string): string {
  const start = markdown.search(/^##\s+Entries\s*$/m);
  if (start === -1) return "";
  const after = markdown.slice(start).replace(/^##\s+Entries\s*$/m, "");
  const nextHeading = after.search(/^##\s+/m);
  return nextHeading === -1 ? after : after.slice(0, nextHeading);
}

function normaliseStatus(value: string | null): string | null {
  if (!value) return null;
  // "Shipped (code) — one-time migration…" -> "Shipped"
  const short = value.split(/[—(]/)[0].trim().replace(/[.:,]$/, "");
  return short || value.trim();
}

function splitList(value: string | null): string[] {
  if (!value) return [];
  // Comma-separated only — some module labels legitimately contain "/"
  // (e.g. "Category (Business/Product/Cuisine)", "Documentation / Repository").
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !/^n\/?a$/i.test(s));
}

function parseEntry(chunk: string): ChangelogEntry | null {
  const lines = chunk.split(/\r?\n/);
  const headerLine = lines.shift()?.trim() ?? "";
  const header = HEADER_RE.exec(headerLine);
  if (!header) return null;

  const [, year, month, day, title] = header;
  const date = `${year}-${month}-${day}`;

  const fields: Record<string, string> = {};
  const technicalChanges: string[] = [];
  let current: string | null = null;

  for (const line of lines) {
    const label = LABEL_RE.exec(line.trim());
    if (label) {
      current = label[1];
      const rest = label[2].trim();
      if (current === "Technical Changes") {
        if (rest) technicalChanges.push(rest.replace(/^[-*]\s+/, ""));
      } else {
        fields[current] = rest;
      }
      continue;
    }
    if (current === "Technical Changes") {
      const trimmed = line.trim();
      if (/^[-*]\s+/.test(trimmed)) {
        technicalChanges.push(trimmed.replace(/^[-*]\s+/, ""));
      } else if (trimmed && technicalChanges.length) {
        technicalChanges[technicalChanges.length - 1] += ` ${trimmed}`;
      }
    } else if (current && line.trim()) {
      fields[current] = `${fields[current] ?? ""} ${line.trim()}`.trim();
    }
  }

  const clean = (v: string | undefined) => {
    const t = (v ?? "").trim();
    return t && !/^n\/?a$/i.test(t) ? t : null;
  };

  // Reference fields (Commit / PR): treat "n/a", "none", "n/a (…)" etc. as empty.
  const cleanRef = (v: string | undefined) => {
    const t = (v ?? "").trim();
    return t && !/^(n\/?a|none|tbd|-)\b/i.test(t) ? t : null;
  };

  const breakingChange = clean(fields["Breaking Change"]);

  return {
    id: `${date}-${slugify(title)}`,
    date,
    year,
    month,
    monthName: monthName(month),
    title: title.trim(),
    modules: splitList(fields["Module"] ?? null),
    type: clean(fields["Type"]),
    status: normaliseStatus(clean(fields["Status"])),
    summary: clean(fields["Title"]),
    description: clean(fields["Description"]),
    technicalChanges,
    commit: cleanRef(fields["Commit"]),
    pullRequest: cleanRef(fields["Pull Request"]),
    breakingChange,
    breaking: /^(yes|partial)/i.test(breakingChange ?? ""),
    relatedDocs: clean(fields["Related Documentation"]),
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const getChangelogEntries = cache((): ChangelogEntry[] => {
  const file = getChangelogFile();
  if (!fs.existsSync(file)) return [];
  const markdown = fs.readFileSync(file, "utf8");
  const block = entriesBlock(markdown);
  if (!block.trim()) return [];

  return block
    .split(/^###\s+/m)
    .map((c) => c.trim())
    .filter(Boolean)
    .map(parseEntry)
    .filter((e): e is ChangelogEntry => e !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
});

export interface ChangelogMonthGroup {
  /** "2026-09" */
  key: string;
  /** "September 2026" */
  label: string;
  entries: ChangelogEntry[];
}

/** Group entries (already newest-first) into month buckets, newest month first. */
export function groupByMonth(entries: ChangelogEntry[]): ChangelogMonthGroup[] {
  const groups: ChangelogMonthGroup[] = [];
  const index = new Map<string, ChangelogMonthGroup>();

  for (const entry of entries) {
    const key = `${entry.year}-${entry.month}`;
    let group = index.get(key);
    if (!group) {
      group = { key, label: `${entry.monthName} ${entry.year}`, entries: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }

  return groups;
}

export interface ChangelogFacets {
  years: string[];
  months: { value: string; label: string }[];
  modules: string[];
  types: string[];
  statuses: string[];
}

export function getChangelogFacets(entries: ChangelogEntry[]): ChangelogFacets {
  const years = new Set<string>();
  const months = new Set<string>();
  const modules = new Set<string>();
  const types = new Set<string>();
  const statuses = new Set<string>();

  for (const e of entries) {
    years.add(e.year);
    months.add(e.month);
    e.modules.forEach((m) => modules.add(m));
    if (e.type) types.add(e.type);
    if (e.status) statuses.add(e.status);
  }

  return {
    years: [...years].sort((a, b) => Number(b) - Number(a)),
    months: [...months]
      .sort((a, b) => Number(a) - Number(b))
      .map((m) => ({ value: m, label: monthName(m) })),
    modules: [...modules].sort((a, b) => a.localeCompare(b)),
    types: [...types].sort((a, b) => a.localeCompare(b)),
    statuses: [...statuses].sort((a, b) => a.localeCompare(b)),
  };
}
