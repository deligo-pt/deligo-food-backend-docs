import "server-only";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { DocCommit } from "@/types";

/**
 * Git history helpers for the local documentation content.
 *
 * The content now lives inside this repository (`content/docs/**`), so history
 * comes from *this* repo's git log. Everything is best-effort: when git is
 * unavailable, the tree is not a repo, or a file is untracked, callers fall
 * back to filesystem timestamps and a dates-unknown UI. Nothing is fabricated.
 *
 * This module also carries the primitives a future "View changes" / diff
 * feature needs — per-file history and working-tree change detection — without
 * yet building any diff UI.
 */

const FIELD = "\x00"; // NUL — field separator inside a commit record
const RECORD = "\x1e"; // RS — record separator between commits
const LOG_FORMAT = `%H${FIELD}%h${FIELD}%cI${FIELD}%an${FIELD}%s${RECORD}`;

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: getRepoRoot() ?? process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch {
    return null;
  }
}

let repoRootCache: string | null | undefined;

/** Absolute path to the enclosing git work tree, or `null` when there is none. */
export function getRepoRoot(): string | null {
  if (repoRootCache !== undefined) return repoRootCache;
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    repoRootCache = out || null;
  } catch {
    repoRootCache = null;
  }
  return repoRootCache;
}

/** Path of an absolute file relative to the repo root, POSIX-style. */
function toRepoRelative(fileAbsPath: string): string | null {
  const root = getRepoRoot();
  if (!root) return null;
  const rel = path.relative(root, fileAbsPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

function parseCommits(raw: string | null): DocCommit[] {
  if (!raw) return [];
  return raw
    .split(RECORD)
    .map((chunk) => chunk.replace(/^\s+/, ""))
    .filter(Boolean)
    .map((chunk) => {
      const [hash, shortHash, date, author, subject] = chunk.split(FIELD);
      return { hash, shortHash, date, author, subject: (subject ?? "").trim() };
    })
    .filter((c) => c.hash && c.date);
}

const lastCommitCache = new Map<string, DocCommit | null>();

/** The most recent commit that touched a file, or `null`. */
export function getLastCommit(fileAbsPath: string): DocCommit | null {
  if (lastCommitCache.has(fileAbsPath)) return lastCommitCache.get(fileAbsPath)!;
  const rel = toRepoRelative(fileAbsPath);
  const commit = rel
    ? (parseCommits(git(["log", "-1", `--format=${LOG_FORMAT}`, "--", rel]))[0] ?? null)
    : null;
  lastCommitCache.set(fileAbsPath, commit);
  return commit;
}

/** Full commit history for a file, newest first (best-effort, capped). */
export function getFileHistory(fileAbsPath: string, limit = 20): DocCommit[] {
  const rel = toRepoRelative(fileAbsPath);
  if (!rel) return [];
  return parseCommits(
    git([
      "log",
      `--max-count=${Math.max(1, limit)}`,
      `--format=${LOG_FORMAT}`,
      "--follow",
      "--",
      rel,
    ]),
  );
}

/**
 * Repo-relative paths under `content/docs` that differ from `HEAD` in the
 * working tree (added / modified / renamed / deleted). Primitive for
 * "changed document detection".
 */
export function getChangedDocPaths(): string[] {
  const out = git(["status", "--porcelain", "--", "content/docs"]);
  if (!out) return [];
  const paths = new Set<string>();
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const rest = line.slice(3);
    const p = rest.includes(" -> ") ? rest.split(" -> ")[1] : rest;
    paths.add(p.replace(/^"(.*)"$/, "$1"));
  }
  return [...paths];
}

export interface LastModified {
  date: string | null;
  source: "git" | "filesystem" | null;
}

/**
 * Best-effort "last modified" for a content file: the last git commit date,
 * else the filesystem mtime, else nothing.
 */
export function getLastModified(fileAbsPath: string): LastModified {
  const commit = getLastCommit(fileAbsPath);
  if (commit) return { date: commit.date, source: "git" };
  try {
    const st = fs.statSync(fileAbsPath);
    return { date: new Date(st.mtimeMs).toISOString(), source: "filesystem" };
  } catch {
    return { date: null, source: null };
  }
}
