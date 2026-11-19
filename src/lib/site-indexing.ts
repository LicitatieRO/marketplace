import type { Metadata } from "next";
import type { MetadataRoute } from "next";

/** Crawling/indexing allowed only on Vercel production with an explicit opt-in. */
export function isSiteIndexingEnabled(): boolean {
  return (
    process.env.VERCEL_ENV?.trim() === "production" &&
    process.env.SITE_INDEXING_ENABLED?.trim() === "true"
  );
}

export const SITE_ROBOTS_DISALLOW_PREFIXES = [
  "/account",
  "/login",
  "/workspace",
  "/saved-searches",
  "/founder",
  "/api/",
  "/auth/",
  "/tiles/",
] as const;

export const SITE_SITEMAP_STATIC_PATHS = [
  "/",
  "/map",
  "/compare",
  "/legal/cookies",
  "/legal/privacy",
  "/legal/terms",
] as const;

const PRIVATE_PAGE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
};

export function privatePageRobotsMetadata(): Pick<Metadata, "robots"> {
  return { robots: PRIVATE_PAGE_ROBOTS };
}

export function siteRootRobotsMetadata(): Pick<Metadata, "robots"> {
  if (isSiteIndexingEnabled()) {
    return {};
  }
  return { robots: PRIVATE_PAGE_ROBOTS };
}

export function buildSiteRobots(
  siteOrigin: string | null,
): MetadataRoute.Robots {
  if (!isSiteIndexingEnabled()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...SITE_ROBOTS_DISALLOW_PREFIXES],
    },
    sitemap: siteOrigin ? `${siteOrigin}/sitemap.xml` : undefined,
  };
}

export function buildPublicSitemapEntries(
  siteOrigin: string,
): MetadataRoute.Sitemap {
  const now = new Date();
  return SITE_SITEMAP_STATIC_PATHS.map((path) => ({
    url: path === "/" ? siteOrigin : `${siteOrigin}${path}`,
    lastModified: now,
  }));
}
