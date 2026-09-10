import "server-only";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { DiffHunk, DocCommit, DocDiff } from "@/types";

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

const FIELD = "\x1f"; // US — field separator inside a commit record
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

// ---------------------------------------------------------------------------
// Latest-change diff ("View changes")
// ---------------------------------------------------------------------------

/**
 * The canonical SHA-1 of Git's empty tree. Diffing against it renders a root
 * commit (one with no parent) as an all-additions patch, so the same
 * `git diff <base> <commit>` shape covers every case.
 */
const EMPTY_TREE_HASH = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

/** Object names we are willing to pass to `git diff`. Full or abbreviated SHA-1. */
const OBJECT_NAME_RE = /^[0-9a-f]{7,40}$/;

/** Upper bound on raw diff bytes we parse and render. */
const MAX_DIFF_BYTES = 128 * 1024;

/** Upper bound on parsed diff lines, so a pathological patch cannot blow up. */
const MAX_DIFF_LINES = 4000;

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

interface ParsedDiff {
  added: boolean;
  hunks: DiffHunk[];
  note: string | null;
  /** True when parsing stopped at the line budget before the diff ended. */
  truncated: boolean;
}

/** Parse unified `git diff` output into structured, numbered hunks. */
function parseUnifiedDiff(raw: string): ParsedDiff {
  const hunks: DiffHunk[] = [];
  let added = false;
  let current: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  let lineBudget = MAX_DIFF_LINES;
  let sawFileHeader = false;

  for (const line of raw.split("\n")) {
    if (line.startsWith("diff --git ")) {
      sawFileHeader = true;
      current = null;
      continue;
    }
    if (line.startsWith("new file mode ")) {
      added = true;
      continue;
    }
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      return {
        added,
        hunks: [],
        note: "Binary file — no line-level diff to show.",
        truncated: false,
      };
    }

    const header = HUNK_HEADER_RE.exec(line);
    if (header) {
      const oldStart = Number(header[1]);
      const newStart = Number(header[3]);
      current = {
        oldStart,
        oldLines: header[2] === undefined ? 1 : Number(header[2]),
        newStart,
        newLines: header[4] === undefined ? 1 : Number(header[4]),
        section: header[5].trim(),
        lines: [],
      };
      hunks.push(current);
      oldNo = oldStart;
      newNo = newStart;
      continue;
    }

    if (!current) continue; // preamble (---, +++, index, mode, rename …)
    if (line.startsWith("\\")) continue; // "\ No newline at end of file"
    if (lineBudget <= 0) break;

    const text = line.slice(1);
    switch (line[0]) {
      case "+":
        current.lines.push({ kind: "add", oldLine: null, newLine: newNo++, text });
        break;
      case "-":
        current.lines.push({ kind: "del", oldLine: oldNo++, newLine: null, text });
        break;
      case " ":
        current.lines.push({
          kind: "context",
          oldLine: oldNo++,
          newLine: newNo++,
          text,
        });
        break;
      default:
        current = null; // end of this file's hunks
        continue;
    }
    lineBudget--;
  }

  let note: string | null = null;
  if (hunks.length === 0 && !added) {
    note = sawFileHeader
      ? "This commit changed only the file's metadata (for example a rename); no lines changed."
      : null;
  }
  return { added, hunks, note, truncated: lineBudget <= 0 };
}

/**
 * Diff of the most recent commit that touched a file against that commit's
 * parent — the data behind the "View changes" action. Returns `null` when the
 * file has no usable git history (untracked, not a repo, git unavailable), so
 * callers can hide the action. Never throws.
 */
export function getLatestFileDiff(fileAbsPath: string): DocDiff | null {
  const rel = toRepoRelative(fileAbsPath);
  if (!rel) return null;

  const commit = getLastCommit(fileAbsPath);
  if (!commit || !OBJECT_NAME_RE.test(commit.hash)) return null;

  // First parent of the commit, if any. `rev-list --parents -n 1` prints
  // "<commit> <parent…>"; a root commit prints just "<commit>".
  const parents = git(["rev-list", "--parents", "-n", "1", commit.hash]);
  const parentHash = parents
    ? (parents.trim().split(/\s+/)[1] ?? null)
    : null;
  const base =
    parentHash && OBJECT_NAME_RE.test(parentHash) ? parentHash : EMPTY_TREE_HASH;

  // All arguments are literals or validated object names; the path is passed
  // after `--` as a single argv entry (execFileSync — no shell).
  const raw = git([
    "diff",
    "--no-color",
    "--unified=3",
    "--no-ext-diff",
    "--find-renames",
    base,
    commit.hash,
    "--",
    rel,
  ]);
  if (raw == null) return null;

  const clipped = raw.length > MAX_DIFF_BYTES;
  const parsed = parseUnifiedDiff(clipped ? raw.slice(0, MAX_DIFF_BYTES) : raw);

  return {
    commit,
    parentShortHash: base === EMPTY_TREE_HASH ? null : base.slice(0, 7),
    added: parsed.added,
    truncated: clipped || parsed.truncated,
    hunks: parsed.hunks,
    note: parsed.note,
  };
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
