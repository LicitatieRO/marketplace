import { expect, test } from "@playwright/test";

test.describe("robots and sitemap (default noindex)", () => {
  test("serves disallow-all robots, sitemap, and noindex headers in non-prod indexing", async ({
    request,
  }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    const robotsBody = await robots.text();
    expect(robotsBody).toMatch(/User-agent:\s*\*/i);
    expect(robotsBody).toMatch(/Disallow:\s*\//);

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const sitemapBody = await sitemap.text();
    expect(sitemapBody).toContain("<urlset");

    const home = await request.get("/");
    expect(home.status()).toBe(200);
    const robotsTag =
      home.headers()["x-robots-tag"] ?? home.headers()["X-Robots-Tag"];
    expect(robotsTag?.toLowerCase()).toContain("noindex");
    expect(robotsTag?.toLowerCase()).toContain("nofollow");
  });
});
