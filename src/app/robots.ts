import type { MetadataRoute } from "next";
import { configuredSiteOrigin } from "@/lib/server/app-origin";
import { buildSiteRobots } from "@/lib/site-indexing";

export default function robots(): MetadataRoute.Robots {
  return buildSiteRobots(configuredSiteOrigin());
}
