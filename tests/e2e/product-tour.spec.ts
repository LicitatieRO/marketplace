import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("licitatiero-language", "ro");
    localStorage.setItem("licitatiero-theme", "light");
    localStorage.setItem("licitatiero-optional-content", "rejected");
    localStorage.removeItem("licitatiero-tour");
  });
});

test.describe("buyer product tour", () => {
  test("desktop ?tour=1 walks B1→B2 then skips", async ({ page }) => {
    await page.goto("/?tour=1");
    const dialog = page.getByTestId("tour-dialog");
    await expect(dialog).toBeVisible();
    await expect(page).not.toHaveURL(/tour=/);
    await expect(dialog.getByRole("heading", { level: 2 })).toContainText(
      "Bun venit",
    );
    await dialog.focus();
    await page.keyboard.press("ArrowRight");
    await expect(dialog.getByRole("heading", { level: 2 })).toContainText(
      "simulare",
    );
    await page.getByTestId("tour-skip").click();
    await expect(dialog).toHaveCount(0);
    const stored = await page.evaluate(() =>
      localStorage.getItem("licitatiero-tour"),
    );
    expect(stored).toContain('"resume"');
  });

  test("Enter on skip ends tour; focus stable after target resolves", async ({
    page,
  }) => {
    await page.goto("/?tour=1");
    const dialog = page.getByTestId("tour-dialog");
    await expect(dialog).toBeVisible();
    await page.getByTestId("tour-skip").focus();
    await expect(page.getByTestId("tour-next")).toBeEnabled({ timeout: 15_000 });
    await expect
      .poll(async () =>
        page.evaluate(
          () =>
            document.activeElement?.getAttribute("data-testid") === "tour-skip",
        ),
      )
      .toBe(true);
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
  });

  test("Tab stays inside dialog", async ({ page }) => {
    await page.goto("/?tour=1");
    const dialog = page.getByTestId("tour-dialog");
    await expect(dialog).toBeVisible();
    await page.getByTestId("tour-next").focus();
    await page.keyboard.press("Tab");
    const trapped = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="tour-dialog"]');
      return Boolean(root?.contains(document.activeElement));
    });
    expect(trapped).toBe(true);
  });

  test("mobile 375px uses bottom sheet", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/?tour=buyer");
    const dialog = page.getByTestId("tour-dialog");
    await expect(dialog).toHaveClass(/tour-dialog--sheet/);
    await page.getByTestId("tour-next").click();
    await expect(dialog).toBeVisible();
    await page.getByTestId("tour-close").click();
    await expect(dialog).toHaveCount(0);
  });
});

test("owner tour without session stays on persona step", async ({ page }) => {
  await page.goto("/?tour=owner");
  const dialog = page.getByTestId("tour-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { level: 2 })).toContainText(
    /proprietar/i,
  );
  const switcher = page.getByTestId("poc-account-switcher");
  if (await switcher.count()) {
    await expect(switcher).toBeVisible();
  } else {
    await expect(page.locator('[data-tour="account-entry"]')).toHaveCount(1);
  }
  await page.getByTestId("tour-skip").click();
  await expect(page).not.toHaveURL(/tab=owner/);
});
