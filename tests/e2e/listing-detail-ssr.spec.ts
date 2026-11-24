import { expect, test } from "@playwright/test";

const DEMO_LISTING_ID = "20000000-0000-4000-8000-000000000001";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("licitatiero-language", "ro");
    localStorage.setItem("licitatiero-theme", "light");
    localStorage.setItem("licitatiero-optional-content", "rejected");
  });
});

test("listing detail page SSR returns 200 and renders map section", async ({
  page,
  request,
}) => {
  const path = `/listings/${DEMO_LISTING_ID}`;
  const response = await request.get(path);
  const html = await response.text();
  expect(response.status(), html).toBe(200);
  expect(html).not.toMatch(/window is not defined/i);

  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByTestId("listing-detail-map")).toBeVisible();
});