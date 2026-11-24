import { expect, test, type Page } from "@playwright/test";
import { switchPocDemoPersona } from "./helpers/poc-demo-switcher";

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

async function assertMapConsentFlow(page: Page, testInfo: { project: { name: string } }) {
  const tileRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("tile.openstreetmap.org")) {
      tileRequests.push(req.url());
    }
  });

  const docResponse = await page.goto("/");
  const referrerPolicy =
    docResponse?.headers()["referrer-policy"] ??
    docResponse?.headers()["Referrer-Policy"];
  expect(referrerPolicy).toBeDefined();
  expect(referrerPolicy).not.toBe("no-referrer");
  expect(referrerPolicy).not.toBe("same-origin");

  const placeholder = page.getByTestId("catalogue-map-placeholder");
  await placeholder.scrollIntoViewIfNeeded();
  await expect(placeholder).toBeVisible();
  expect(tileRequests).toHaveLength(0);

  await page.getByTestId("catalogue-map-accept").click();
  await expect(page.getByTestId("catalogue-map-interactive")).toBeVisible({
    timeout: testInfo.project.name === "mobile" ? 30_000 : 15_000,
  });

  await expect(
    page.locator('.leaflet-control-attribution a[href="https://www.openstreetmap.org/copyright"]'),
  ).toBeVisible();
  await expect(
    page.locator(".leaflet-control-attribution"),
  ).toContainText("OpenStreetMap");
  await expect(page.getByTestId("catalogue-map-report-issue")).toBeVisible();
  await expect(page.getByTestId("catalogue-map-report-issue")).toHaveAttribute(
    "href",
    "https://www.openstreetmap.org/fixthemap",
  );

  await expect
    .poll(() => tileRequests.length, { timeout: 15_000 })
    .toBeGreaterThan(0);
  for (const url of tileRequests) {
    expect(url).toMatch(TILE_URL_PATTERN);
  }

  await expect(
    page.locator(".lr-price-pill").first(),
  ).toBeVisible({
    timeout: 15_000,
  });
}

test.describe("catalogue map consent (logged out)", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMapPage(page);
  });

  test("placeholder blocks OSM tiles until per-map accept", async ({
    page,
  }, testInfo) => {
    test.setTimeout(testInfo.project.name === "mobile" ? 60_000 : 45_000);
    await assertMapConsentFlow(page, testInfo);
  });
});

test.describe("catalogue map consent (logged in POC)", () => {
  test.skip(
    process.env.E2E_BACKEND !== "1",
    "Requires the configured local Supabase backend",
  );
  test.skip(
    process.env.POC_SWITCHER_ENABLED !== "true",
    "Requires POC switcher for seeded session",
  );

  test.beforeEach(async ({ page }) => {
    await prepareMapPage(page);
  });

  test("signed-in owner sees same consent gate and tiles", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "POC switcher covered on desktop in auth-poc",
    );
    test.setTimeout(60_000);
    await page.goto("/");
    await switchPocDemoPersona(page, "owner", { waitForSwitchApi: true });
    await assertMapConsentFlow(page, testInfo);
  });
});