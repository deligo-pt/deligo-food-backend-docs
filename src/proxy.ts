import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { safeNextPath } from "@/lib/safe-redirect";

/**
 * Request gate for the private documentation portal (Next.js 16 `proxy`,
 * formerly `middleware`). Runs before any route renders and before a
 * statically generated page is served, so the SSG output stays intact while
 * every protected response still requires a valid session.
 *
 * `/login` is the only public route (its sign-in Server Action posts back to
 * it). Everything else — pages, RSC payloads and `/api/*` — needs a session
 * cookie that verifies against `DOCS_SESSION_SECRET`; otherwise `/login?next=…`
 * (or `401` for `/api/*`). `private, no-store` / `noindex` headers for
 * protected responses come from `next.config.ts`.
 */

function isPublicPath(pathname: string): boolean {
  return pathname === "/login";
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  const session = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (isPublicPath(pathname)) {
    if (session && pathname === "/login") {
      const dest = safeNextPath(request.nextUrl.searchParams.get("next"));
      return NextResponse.redirect(new URL(dest, request.nextUrl.origin));
    }
    return NextResponse.next();
  }

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const loginUrl = new URL("/login", request.nextUrl.origin);
  loginUrl.searchParams.set("next", safeNextPath(pathname + search));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except immutable build assets and the public metadata files.
  // `_next/data` and `.rsc` requests are intentionally still matched.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
