import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { getDocsContentDir } from "@/lib/config";
import { getSession } from "@/lib/auth";

/**
 * Streams a non-Markdown file co-located with the documentation, e.g. an image
 * referenced relatively from a `.md` file. Resolves strictly inside
 * `content/docs/` (no traversal) and never serves Markdown source.
 *
 * `proxy.ts` already gates this route, but it also verifies the session here
 * independently: any request path that reaches a route handler without going
 * through the proxy (e.g. an internal image-optimizer fetch) still gets nothing.
 */

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".json": "application/json",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const DENIED_EXT = new Set([".md", ".mdx", ".markdown"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!(await getSession())) {
    return new Response("Not found", { status: 404 });
  }

  const { path: segments } = await params;
  const root = getDocsContentDir();
  const target = path.resolve(root, ...segments);

  // Containment check — defence in depth on top of Next's own normalisation.
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(target).toLowerCase();
  if (DENIED_EXT.has(ext)) {
    return new Response("Not found", { status: 404 });
  }

  let size: number;
  try {
    const st = statSync(target);
    if (!st.isFile()) return new Response("Not found", { status: 404 });
    size = st.size;
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const body = Readable.toWeb(createReadStream(target)) as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "Content-Length": String(size),
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
