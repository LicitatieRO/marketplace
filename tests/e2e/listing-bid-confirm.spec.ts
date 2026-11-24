import { expect, type Page, test } from "@playwright/test";

async function prepareMapPage(page: Page) {
  await page.goto("/map");
  const placeholder = page.getByTestId("listings-map-placeholder");
  if (await placeholder.isVisible()) {
    await page.getByTestId("listings-map-accept").click();
  }
}

test.describe("property page bid confirm (#120)", () => {
  test("demo listing shows POC labelling for guests", async ({ page }) => {
    test.skip(
      process.env.NEXT_PUBLIC_DEMO_MODE !== "true",
      "Demo catalogue listing",
    );
    const listingId = "20000000-0000-4000-8000-000000000001";
    await page.goto(`/listings/${listingId}`);
    await expect(page.getByTestId("listing-bid-poc-chip")).toHaveText(
      /POC \/ Simulare/,
    );
    const login = page.getByTestId("listing-guest-bid-login");
    await expect(login).toBeVisible();
    await expect(login).toHaveAttribute(
      "href",
      new RegExp(`next=%2Flistings%2F${listingId}`),
    );
    await expect(login).toHaveAttribute("href", /intent=bid/);
    await expect(page.getByTestId("listing-bid-confirm-panel")).toHaveCount(0);
  });
});

test.describe("property page bid confirm (authenticated POC)", () => {
  test.skip(
    process.env.E2E_BACKEND !== "1",
    "Requires the configured local Supabase backend",
  );
  test.skip(
    process.env.POC_SWITCHER_ENABLED !== "true",
    "Requires POC switcher for seeded session",
  );

  test("confirm step gates place_bid on the property page", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Desktop integration path");
  test.setTimeout(120_000);
    const listingId = "20000000-0000-4000-8000-000000000001";
    await prepareMapPage(page);
    await page.goto("/");
    const switchBuyer = page.waitForResponse(
      (response) =>
        response.url().includes("/api/poc/switch-account") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    );
    await page.getByRole("button", { name: "Cumpărător", exact: true }).click();
    expect((await switchBuyer).ok()).toBe(true);
    await page.goto(`/listings/${listingId}`);
    await expect(page.getByTestId("listing-bid-control")).toBeVisible();
    await page.getByTestId("listing-place-bid").click();
    await expect(page.getByTestId("listing-bid-confirm-panel")).toBeVisible();
    await page.getByTestId("listing-bid-confirm").click();
    await expect(page.getByTestId("listing-bid-confirm-panel")).toHaveCount(0, {
      timeout: 20_000,
    });
  });
});