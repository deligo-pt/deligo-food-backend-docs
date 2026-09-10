import "server-only";
import fs from "node:fs";
import { cache } from "react";
import type { Decision } from "@/types";
import { getDecisionsFile } from "./config";

const FIELD_LABELS = [
  "Status",
  "Context",
  "Problem",
  "Decision",
  "Reason",
  "Alternatives",
  "Consequences",
  "Affected Modules",
  "Source References",
] as const;

const LABEL_RE = new RegExp(`^(${FIELD_LABELS.join("|")}):\\s?(.*)$`);
const HEADER_RE = /^(\d{4})-(\d{2})-(\d{2})\s+[—-]\s+(.+)$/;

function entriesBlock(markdown: string): string {
  const start = markdown.search(/^##\s+Entries\s*$/m);
  if (start === -1) return "";
  const after = markdown.slice(start).replace(/^##\s+Entries\s*$/m, "");
  const nextHeading = after.search(/^##\s+/m);
  return nextHeading === -1 ? after : after.slice(0, nextHeading);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function normaliseStatus(value: string | null): string | null {
  if (!value) return null;
  // Leading word only: "Superseded by …" -> "Superseded",
  // "Accepted (supersedes …)" -> "Accepted".
  const first = value.trim().split(/[\s—(]+/)[0].replace(/[.:,]$/, "");
  return first || value.trim();
}

function parseEntry(chunk: string): Decision | null {
  const lines = chunk.split(/\r?\n/);
  const headerLine = lines.shift()?.trim() ?? "";
  const header = HEADER_RE.exec(headerLine);
  if (!header) return null;

  const [, year, month, day, title] = header;
  const date = `${year}-${month}-${day}`;
  void month;
  void day;

  const fields: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of lines) {
    const label = LABEL_RE.exec(line.trim());
    if (label) {
      current = label[1];
      fields[current] = [];
      if (label[2].trim()) fields[current].push(label[2].trim());
      continue;
    }
    if (current) fields[current].push(line);
  }

  const get = (label: string): string | null => {
    const parts = fields[label];
    if (!parts) return null;
    const text = parts.join("\n").replace(/\s+$/g, "").trim();
    return text && !/^n\/?a$/i.test(text) ? text : null;
  };

  const affected = (get("Affected Modules") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const status = get("Status");

  return {
    id: `${date}-${slugify(title)}`,
    date,
    year,
    title: title.trim(),
    status,
    statusLabel: normaliseStatus(status),
    context: get("Context"),
    problem: get("Problem"),
    decision: get("Decision"),
    reason: get("Reason"),
    alternatives: get("Alternatives"),
    consequences: get("Consequences"),
    affectedModules: affected,
    sourceReferences: get("Source References"),
  };
}

export const getDecisions = cache((): Decision[] => {
  const file = getDecisionsFile();
  if (!fs.existsSync(file)) return [];
  const markdown = fs.readFileSync(file, "utf8");
  const block = entriesBlock(markdown);
  if (!block.trim()) return [];

  return block
    .split(/^###\s+/m)
    .map((c) => c.trim())
    .filter(Boolean)
    .map(parseEntry)
    .filter((d): d is Decision => d !== null)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
});

export interface DecisionFacets {
  years: string[];
  statuses: string[];
}

export function getDecisionFacets(decisions: Decision[]): DecisionFacets {
  const years = new Set<string>();
  const statuses = new Set<string>();
  for (const d of decisions) {
    years.add(d.year);
    if (d.statusLabel) statuses.add(d.statusLabel);
  }
  return {
    years: [...years].sort((a, b) => Number(b) - Number(a)),
    statuses: [...statuses].sort((a, b) => a.localeCompare(b)),
  };
}
