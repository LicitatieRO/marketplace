import { expect, test } from "@playwright/test";

test.describe("social login (coming soon) and data deletion legal page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-theme", "light");
      localStorage.setItem("licitatiero-optional-content", "rejected");
    });
  });

  test("login page shows three disabled coming-soon provider buttons (RO)", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-language", "ro");
    });
    await page.goto("/account?mode=login");
    await expect(page.getByTestId("social-login")).toBeVisible();
    for (const provider of ["google", "apple", "facebook"]) {
      const button = page.getByTestId(`social-login-${provider}`);
      await expect(button).toBeVisible();
      await expect(button).toBeDisabled();
      await expect(button).toContainText("În curând");
    }
  });

  test("/legal/data-deletion renders in Romanian and English", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-language", "ro");
    });
    await page.goto("/legal/data-deletion");
    await expect(
      page.getByRole("heading", {
        name: "Instrucțiuni de ștergere a datelor (cerință Meta)",
      }),
    ).toBeVisible();

    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-language", "en");
    });
    await page.goto("/legal/data-deletion");
    await expect(
      page.getByRole("heading", {
        name: "Data deletion instructions (Meta requirement)",
      }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Notifications you received and auction invitations you never acted on are also deleted with your account.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "If you sent auction invitations or placed bids, automatic deletion may be blocked",
      ),
    ).toBeVisible();
    await expect(page.getByText("favourites, notifications or promotions")).toHaveCount(0);
    await expect(
      page.getByText(
        "In-app deletion is available if your account has no recorded activity (for example listings, auctions, bids, reservations, messages, viewing requests, favourites or promotions).",
      ),
    ).toBeVisible();
  });
});
