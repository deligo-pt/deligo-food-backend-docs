import path from "node:path";

/**
 * Documentation content now lives inside this repository, under `content/`.
 * There is no external documentation repo and no sync step — the Markdown is
 * committed here and rendered directly.
 *
 *   content/docs/        every Markdown file, discovered recursively
 *   content/changelog.md optional Change Log source (see lib/changelog.ts)
 *   content/decisions.md optional Decision Log source (see lib/decisions.ts)
 *
 * Paths resolve from the project root (`process.cwd()` during `next build` and
 * `next start`). Nothing here is configurable by environment variable.
 */

function fromRoot(...segments: string[]): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), ...segments);
}

/** Absolute path to the content root. */
export function getContentDir(): string {
  return fromRoot("content");
}

/** Absolute path to the auto-discovered Markdown tree. */
export function getDocsContentDir(): string {
  return fromRoot("content", "docs");
}

/** Absolute path to the optional Change Log source file. */
export function getChangelogFile(): string {
  return fromRoot("content", "changelog.md");
}

/** Absolute path to the optional Decision Log source file. */
export function getDecisionsFile(): string {
  return fromRoot("content", "decisions.md");
}

export const SITE = {
  name: "Deligo Engineering",
  shortName: "Deligo Docs",
  description:
    "Internal engineering documentation for the Deligo food-delivery platform — architecture, modules, API surface, data model, operations, and the change & decision logs.",
  url: "https://docs.deligo.pt",
} as const;

/** Dedicated routes that are sourced from content but not served as plain doc pages. */
export const SPECIAL_ROUTES = {
  changelog: "/changelog",
  decisions: "/decisions",
} as const;
