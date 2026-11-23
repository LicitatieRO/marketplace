import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("licitatiero-language", "ro");
    localStorage.setItem("licitatiero-theme", "light");
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

  test("property bid opens confirm; cancel sends nothing", async ({
    page,
    request,
  }) => {
    test.skip(
      process.env.E2E_BACKEND !== "1",
      "Confirm-step bid needs configured backend and buyer session",
    );
    const catalogue = (await (await request.get("/api/catalogue")).json()).data;
    const listing = catalogue.find(
      (item: { auction_mode: string | null; id: string }) =>
        item.auction_mode === "ascending",
    );
    expect(listing).toBeTruthy();
    await page.goto("/account");
    await page.getByLabel("Adresa de email").fill(process.env.E2E_BUYER_EMAIL!);
    await page.getByLabel("Parola", { exact: true }).fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Intră în cont", exact: true }).click();
    await page.goto(`/listings/${listing.id}`);
    const minimum =
      (listing.current_bid_minor ?? listing.starting_price_minor ?? 0) +
      (listing.min_increment_minor ?? 0);
    const amount = (minimum + 10_000) / 100;
    await page.getByLabel("Oferta ta în EUR").fill(String(amount));
    await page.getByTestId("listing-place-bid").click();
    await expect(page.getByTestId("listing-bid-confirm-panel")).toBeVisible();
    await page
      .getByTestId("listing-bid-confirm-panel")
      .getByRole("button", { name: "Anulează", exact: true })
      .click();
    await expect(page.getByTestId("listing-bid-confirm-panel")).toHaveCount(0);
    await expect(
      page.locator(".feedback.success").filter({ hasText: "înregistrată" }),
    ).toHaveCount(0);
  });
});
