import { expect, test, type Page } from "@playwright/test";
import {
  attachCspViolationCollector,
  expectCspDocumentHeader,
  installCspViolationDomProbe,
} from "./helpers/csp";

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
}

test.describe("Content-Security-Policy smoke", () => {
  test.beforeEach(async ({ page }) => {
    await installCspViolationDomProbe(page);
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-optional-content", "rejected");
      localStorage.setItem("licitatiero-language", "ro");
    });
  });

  test("document responses include a nonce-based CSP", async ({ page }) => {
    await expectCspDocumentHeader(page, "/");
  });

  test("catalogue map flow has no CSP console violations", async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "mobile" ? 60_000 : 45_000);
    const csp = attachCspViolationCollector(page);
    await prepareMapPage(page);
    await page.goto("/");
    const placeholder = page.getByTestId("catalogue-map-placeholder");
    await placeholder.scrollIntoViewIfNeeded();
    await page.getByTestId("catalogue-map-accept").click();
    await expect(page.getByTestId("catalogue-map-interactive")).toBeVisible({
      timeout: testInfo.project.name === "mobile" ? 30_000 : 15_000,
    });
    await expect(page.locator(".lr-price-pill").first()).toBeVisible({
      timeout: 15_000,
    });
    const domViolations = await csp.readDomViolations();
    expect(domViolations).toEqual([]);
    csp.assertClean("catalogue map");
  });

  test("auth/legal surfaces have no CSP console violations", async ({
    page,
  }) => {
    const csp = attachCspViolationCollector(page);
    await page.goto("/");
    await expect(page.getByTestId("poc-simulation-banner")).toBeVisible();
    await page.goto("/legal/terms");
    await page.goto("/legal/privacy");
    await page.goto("/account?mode=login");
    const domViolations = await csp.readDomViolations();
    expect(domViolations).toEqual([]);
    csp.assertClean("auth/legal");
  });
});
