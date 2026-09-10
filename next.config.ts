import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy for the documentation portal.
 *
 * `script-src` keeps `'unsafe-inline'`: Next.js App Router inlines its hydration
 * bootstrap (`self.__next_f.push(...)`) and next-themes inlines an anti-FOUC
 * script, both un-nonced, in statically rendered HTML. A nonce-based policy
 * would force every page into dynamic rendering and defeat SSG. The production
 * policy has NO `'unsafe-eval'` — React, Next and the Mermaid ESM build used
 * here do not need it; `next dev` (HMR) does, so it is added in development
 * only, together with the HMR websocket in `connect-src`. `style-src` allows
 * `'unsafe-inline'` for next/font's `@font-face` block, next-themes'
 * transition-suppression style, and Mermaid's inline SVG styles.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // This project lives inside a larger workspace; pin the root so Turbopack does
  // not walk up into the home directory looking for a lockfile.
  turbopack: {
    root: process.cwd(),
  },

  // Do not advertise the framework.
  poweredByHeader: false,

  // Documentation images render as plain <img>; next/image is never used. Turn
  // the on-demand optimizer off so `/_next/image` cannot fetch private,
  // auth-gated files out of `content/docs`.
  images: { unoptimized: true },

  // The whole portal is private (see `proxy.ts`). Keep every rendered response
  // — HTML, RSC payloads and JSON — out of shared/CDN caches and out of search
  // indexes. Immutable build assets under `/_next/` keep Next's own long-lived
  // caching; `favicon.ico` and `robots.txt` stay publicly cacheable.
  //
  // HSTS is intentionally NOT set here: it must only be emitted over HTTPS, and
  // this app runs behind a TLS-terminating reverse proxy over a plaintext
  // loopback hop. HSTS belongs on that proxy — see DEPLOYMENT.md.
  async headers() {
    return [
      {
        source: "/((?!_next/|favicon.ico|robots.txt|sitemap.xml).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // Security headers for document responses. `/docs-assets/*` is excluded:
        // its route handler sets its own stricter, self-contained CSP.
        source:
          "/((?!_next/|docs-assets/|favicon.ico|robots.txt|sitemap.xml).*)",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // Cheap and safe on every response, including build assets.
        source: "/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
};

export default nextConfig;
