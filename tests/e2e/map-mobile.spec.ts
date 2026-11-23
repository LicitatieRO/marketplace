import { expect, test, type Page } from "@playwright/test";

const TILE_URL_PATTERN =
  /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;

async function prepareMapPage(page: Page) {
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
  await page.addInitScript(() => {
    localStorage.setItem("licitatiero-optional-content", "rejected");
    localStorage.setItem("licitatiero-language", "ro");
  });
}

async function openMobileMapWithConsent(page: Page) {
  await page.goto("/map");
  await expect(page.getByTestId("listings-map-page")).toBeVisible();
  const accept = page.getByTestId("listings-map-accept");
  if (await accept.isVisible()) {
    await accept.click();
  }
  await page.getByTestId("listings-map-mobile-toggle").click();
  await expect(page.getByTestId("listings-map-interactive")).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("listings map mobile canvas", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMapPage(page);
  });

  test("map tiles, markers and attribution layout", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile viewport only");
    test.setTimeout(60_000);

    const tileRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("tile.openstreetmap.org")) {
        tileRequests.push(req.url());
      }
    });

    await openMobileMapWithConsent(page);

    const container = page.locator(".leaflet-container").first();
    await expect(container).toBeVisible({ timeout: 15_000 });

    const mapBox = await container.boundingBox();
    expect(mapBox).toBeTruthy();
    expect(mapBox!.width).toBeGreaterThan(120);
    expect(mapBox!.height).toBeGreaterThan(120);

    await expect
      .poll(() => tileRequests.length, { timeout: 15_000 })
      .toBeGreaterThan(0);

    const tileOrMarker = page
      .locator(".leaflet-tile, .lr-price-pill, .lr-cluster-wrap")
      .first();
    await expect(tileOrMarker).toBeVisible({ timeout: 20_000 });

    const attribution = page.locator(".leaflet-control-attribution").first();
    await expect(attribution).toBeVisible();
    await expect(attribution).toContainText("OpenStreetMap");

    const attrBox = await attribution.boundingBox();
    expect(attrBox).toBeTruthy();
    expect(attrBox!.width).toBeGreaterThan(attrBox!.height);
  });
});