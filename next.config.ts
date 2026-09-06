import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This project lives inside a larger workspace; pin the root so Turbopack does
  // not walk up into the home directory looking for a lockfile.
  turbopack: {
    root: process.cwd(),
  },

  // The whole portal is private (see `proxy.ts`). Keep every rendered response
  // — HTML, RSC payloads and JSON — out of shared/CDN caches and out of search
  // indexes. Immutable build assets under `/_next/` keep Next's own long-lived
  // caching; `favicon.ico` and `robots.txt` stay publicly cacheable.
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
    ];
  },
};

export default nextConfig;
