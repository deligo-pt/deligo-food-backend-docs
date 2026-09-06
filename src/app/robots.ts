import type { MetadataRoute } from "next";

/**
 * The portal is private, so nothing should be crawled or indexed. This is
 * served publicly (the proxy excludes `/robots.txt`) so crawlers can read it
 * without being redirected to the login page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
