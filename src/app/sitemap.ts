import type { MetadataRoute } from "next";
import { configuredSiteOrigin } from "@/lib/server/app-origin";
import { buildPublicSitemapEntries } from "@/lib/site-indexing";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = configuredSiteOrigin();
  if (!origin) {
    return [];
  }
  return buildPublicSitemapEntries(origin);
}
