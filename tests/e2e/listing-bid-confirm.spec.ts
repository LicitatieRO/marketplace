import { expect, test } from "@playwright/test";

test.describe("property page bid confirm (#120)", () => {
  test("guest sees POC labelling and bid intent login without auto-submit", async ({
    page,
  }) => {
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
    await expect(page.getByTestId("listing-place-bid")).toHaveCount(0);
  });
});
