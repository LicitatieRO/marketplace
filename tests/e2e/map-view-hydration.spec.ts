import { expect, test, type Page } from "@playwright/test";

const TILE_URL_PATTERN =
  /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;

const HYDRATION_PATTERN = /hydration|Minified React error #418/i;

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

test.describe("map view deep link hydration", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMapPage(page);
  });

  for (const projectName of ["desktop", "mobile"] as const) {
    test(`no hydration mismatch on /map?view=map (${projectName})`, async ({
      page,
    }, testInfo) => {
      test.skip(testInfo.project.name !== projectName, `${projectName} only`);

      const hydrationSignals: string[] = [];
      page.on("console", (msg) => {
        const text = msg.text();
        if (HYDRATION_PATTERN.test(text)) {
          hydrationSignals.push(text);
        }
      });

      await page.goto("/map?view=map");
      await expect(page.getByTestId("listings-map-page")).toBeVisible();
      await expect(page.locator(".listings-map-layout")).toHaveAttribute(
        "data-map-layout-view",
        "map",
      );
      expect(hydrationSignals).toEqual([]);
    });
  }
});