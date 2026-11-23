import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("licitatiero-language", "ro");
    localStorage.setItem("licitatiero-theme", "light");
    localStorage.removeItem("licitatiero-product-tour");
  });
});

test("starts from ?tour=1, advances one step, then skips", async ({ page }) => {
  await page.goto("/?tour=1");
  const dialog = page.getByTestId("tour-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 2 })).toContainText(
    "Bine ai venit",
  );
  await page.getByTestId("tour-next").click();
  await expect(dialog.getByRole("heading", { level: 2 })).toContainText(
    "Caută și filtrează",
  );
  await page.getByTestId("tour-skip").click();
  await expect(dialog).toHaveCount(0);
});