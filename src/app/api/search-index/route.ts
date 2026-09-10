import { NextResponse } from "next/server";
import { buildSearchIndex } from "@/lib/search";
import { getSession } from "@/lib/auth";

/**
 * The search index as a single JSON payload.
 *
 * This payload contains the full text of every private document, so it must
 * never be a build artifact served unconditionally: the route is dynamic and
 * checks the session on every request (defence in depth alongside `proxy.ts`),
 * and the response is marked private and non-cacheable.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!(await getSession())) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(buildSearchIndex(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
