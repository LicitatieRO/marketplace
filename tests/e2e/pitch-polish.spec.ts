import { test, expect } from "@playwright/test";

test.describe("pitch polish chrome", () => {
  test("hero heading is in viewport and POC disclosure present at 375px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    const heroHeading = page.locator(".hero h1");
    await expect(heroHeading).toBeVisible();
    const box = await heroHeading.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(667);

    const pocBanner = page.getByTestId("poc-simulation-banner");
    await expect(pocBanner).toBeVisible();
    await expect(pocBanner).toHaveAttribute("role", "status");
  });

  test("opengraph image returns image/png", async ({ request }) => {
    const response = await request.get("/opengraph-image");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });
});
