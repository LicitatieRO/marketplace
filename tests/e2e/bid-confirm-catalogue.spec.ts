import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("licitatiero-language", "ro");
    localStorage.setItem("licitatiero-theme", "light");
    localStorage.setItem("licitatiero-optional-content", "rejected");
  });
});

test.describe("bid confirm and catalogue auction row", () => {
  test("catalogue card shows current bid and time left for live ascending auction", async ({
    page,
  }) => {
    await page.goto("/");
    const liveCard = page
      .locator(".property-card")
      .filter({ hasText: "Licitație simulată (POC)" })
      .first();
    await expect(liveCard.getByTestId("catalogue-card-auction-meta")).toBeVisible();
    await expect(liveCard.getByTestId("catalogue-card-auction-meta")).toContainText(
      "Ofertă curentă",
    );
    await expect(liveCard.getByTestId("catalogue-card-time-left")).toBeVisible();
  });
});