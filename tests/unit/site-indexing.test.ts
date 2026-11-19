import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildPublicSitemapEntries,
  buildSiteRobots,
  isSiteIndexingEnabled,
  siteRootRobotsMetadata,
} from "@/lib/site-indexing";

const env = process.env;

beforeEach(() => {
  process.env = { ...env };
});

afterEach(() => {
  process.env = { ...env };
});

describe("isSiteIndexingEnabled", () => {
  it("is off unless production Vercel env and SITE_INDEXING_ENABLED=true", () => {
    delete process.env.VERCEL_ENV;
    delete process.env.SITE_INDEXING_ENABLED;
    expect(isSiteIndexingEnabled()).toBe(false);

    process.env.VERCEL_ENV = "preview";
    process.env.SITE_INDEXING_ENABLED = "true";
    expect(isSiteIndexingEnabled()).toBe(false);

    process.env.VERCEL_ENV = "production";
    process.env.SITE_INDEXING_ENABLED = "TRUE";
    expect(isSiteIndexingEnabled()).toBe(false);

    process.env.SITE_INDEXING_ENABLED = "true";
    expect(isSiteIndexingEnabled()).toBe(true);
  });
});

describe("siteRootRobotsMetadata", () => {
  it("defaults to noindex when indexing is disabled", () => {
    delete process.env.VERCEL_ENV;
    expect(siteRootRobotsMetadata()).toEqual({
      robots: { index: false, follow: false },
    });
  });

  it("omits robots override when indexing is enabled", () => {
    process.env.VERCEL_ENV = "production";
    process.env.SITE_INDEXING_ENABLED = "true";
    expect(siteRootRobotsMetadata()).toEqual({});
  });
});

describe("buildSiteRobots", () => {
  const origin = "https://licitatiero.example";

  it("disallows everything when indexing is disabled", () => {
    delete process.env.VERCEL_ENV;
    const robots = buildSiteRobots(origin);
    expect(robots.rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(robots.sitemap).toBeUndefined();
  });

  it("allows public paths with private prefixes blocked when indexing is enabled", () => {
    process.env.VERCEL_ENV = "production";
    process.env.SITE_INDEXING_ENABLED = "true";
    const robots = buildSiteRobots(origin);
    expect(robots.rules).toMatchObject({
      userAgent: "*",
      allow: "/",
      disallow: expect.arrayContaining(["/account", "/api/", "/founder"]),
    });
    expect(robots.sitemap).toBe(`${origin}/sitemap.xml`);
  });
});

describe("buildPublicSitemapEntries", () => {
  it("lists only configured static public pages", () => {
    const entries = buildPublicSitemapEntries("https://app.example.test");
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain("https://app.example.test");
    expect(urls).toContain("https://app.example.test/map");
    expect(urls).toContain("https://app.example.test/legal/privacy");
    expect(urls.some((url) => url.includes("/listings/"))).toBe(false);
    expect(urls.some((url) => url.includes("/account"))).toBe(false);
  });
});
