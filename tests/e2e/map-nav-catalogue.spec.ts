import { expect, test } from "@playwright/test";

test.describe("catalogue map discoverability (#114)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-optional-content", "rejected");
      localStorage.setItem("licitatiero-language", "ro");
    });
  });

  test("desktop header Hartă link opens /map and carries neighbourhood filter", async ({
    page,
  }, testInfo) => {
    test.setTimeout(
      process.env.E2E_BACKEND === "1" ? 90_000 : 45_000,
    );
    test.skip(
      testInfo.project.name === "mobile",
      "Desktop nav link; mobile uses collapsible menu + catalogue CTA",
    );
    await page.goto("/");
    const mapNav = page.getByTestId("nav-map-link");
    await expect(mapNav).toHaveAttribute("href", "/map");

    await page.getByRole("button", { name: /^Filtre/ }).click();
    await page.getByLabel("Cartier", { exact: true }).selectOption("Floreasca");
    const href = await mapNav.getAttribute("href");
    expect(href).toMatch(/^\/map\?/);
    expect(href).toContain("neighborhood=Floreasca");

    await mapNav.click();
    await expect(page).toHaveURL(/\/map\?.*neighborhood=Floreasca/);
    await expect(page.getByTestId("listings-map-page")).toBeVisible();
    const mapCards = page.locator('[data-testid^="map-list-card-"]');
    await expect
      .poll(async () => mapCards.count(), { timeout: 45_000 })
      .toBeGreaterThan(0);
    const count = await mapCards.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(mapCards.nth(i)).toContainText("Floreasca");
    }
  });

  test("mobile menu Hartă and catalogue CTA carry filters to /map", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only nav surface");
    await page.goto("/");
    await page.getByRole("button", { name: /^Filtre/ }).click();
    await page.getByLabel("Cartier", { exact: true }).selectOption("Floreasca");

    await page.getByRole("button", { name: "Deschide meniul" }).click();
    const mapNav = page.getByTestId("nav-map-link-mobile");
    await expect(mapNav).toHaveAttribute("href", /neighborhood=Floreasca/);
    await mapNav.click();
    await expect(page.getByTestId("listings-map-page")).toBeVisible();
  });

  test("homepage catalogue map uses price pills after consent", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.route("**/*tile.openstreetmap.org/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
    });
    await page.goto("/");
    const accept = page.getByTestId("catalogue-map-accept");
    await accept.scrollIntoViewIfNeeded();
    if (await accept.isVisible()) {
      await accept.click();
    }
    await expect(page.getByTestId("catalogue-map-interactive")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("catalogue-map-open-full")).toHaveAttribute(
      "href",
      "/map",
    );
    await expect(page.locator(".lr-price-pill").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.locator('img.leaflet-marker-icon[src*="marker-icon"]'),
    ).toHaveCount(0);
  });
});
