import { expect, test, type Page } from "@playwright/test";

const PMTILES_PATTERN = /bucharest-ilfov\.pmtiles/;

async function acceptCatalogueMap(page: Page) {
  await page.goto("/");
  const placeholder = page.getByTestId("catalogue-map-placeholder");
  if (await placeholder.isVisible()) {
    await placeholder.scrollIntoViewIfNeeded();
    await page.getByTestId("catalogue-map-accept").click();
  }
  await expect(page.getByTestId("catalogue-map-interactive")).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("map tile PMTiles fallback", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-optional-content", "accepted");
      localStorage.setItem("licitatiero-language", "ro");
    });
  });

  test("forced OSM failure switches to fallback with ODbL attribution", async ({
    page,
  }) => {
    await page.route("**/*tile.openstreetmap.org/**", (route) =>
      route.abort("failed"),
    );

    const pmtilesRequests: string[] = [];
    page.on("request", (req) => {
      if (PMTILES_PATTERN.test(req.url())) {
        pmtilesRequests.push(req.url());
      }
    });

    await acceptCatalogueMap(page);

    await expect
      .poll(() => pmtilesRequests.length, { timeout: 45_000 })
      .toBeGreaterThan(0);

    await expect(page.locator(".leaflet-control-attribution")).toContainText(
      "ODbL",
    );
    await expect(
      page.locator(
        '.leaflet-control-attribution a[href="https://www.openstreetmap.org/copyright"]',
      ),
    ).toBeVisible();
    await expect(page.locator(".leaflet-container")).toHaveCount(1);
  });

  test("healthy OSM does not request the PMTiles extract", async ({ page }) => {
    const TILE_URL_PATTERN =
      /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;

    await page.route("**/*tile.openstreetmap.org/**", async (route) => {
      if (TILE_URL_PATTERN.test(route.request().url())) {
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
            "base64",
          ),
        });
        return;
      }
      await route.abort("blockedbyclient");
    });

    const pmtilesRequests: string[] = [];
    page.on("request", (req) => {
      if (PMTILES_PATTERN.test(req.url())) {
        pmtilesRequests.push(req.url());
      }
    });

    await acceptCatalogueMap(page);
    await expect(page.locator(".lr-price-pill").first()).toBeVisible({
      timeout: 20_000,
    });
    await page.waitForTimeout(2_000);
    expect(pmtilesRequests).toHaveLength(0);
  });
});

test.describe("MAP_TILE_PROVIDER=off", () => {
  test.skip(
    process.env.MAP_TILE_PROVIDER !== "off",
    "Requires MAP_TILE_PROVIDER=off when the app server starts",
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-optional-content", "accepted");
      localStorage.setItem("licitatiero-language", "ro");
    });
  });

  test("off mode hides the map gracefully while list works on /map", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("catalogue-map-unavailable")).toBeVisible();

    await page.goto("/map");
    await expect(page.getByTestId("listings-map-page")).toBeVisible();
    await expect(page.getByTestId("map-globally-unavailable")).toBeVisible();
    await expect(
      page.locator("[data-testid^=map-list-card-]").first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});