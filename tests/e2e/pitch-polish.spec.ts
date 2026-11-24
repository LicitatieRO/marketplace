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

  test("cookie consent reject and accept use the same button class", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    const banner = page.getByTestId("cookie-consent-banner");
    await expect(banner).toBeVisible();
    const reject = page.getByTestId("cookie-consent-reject");
    const accept = page.getByTestId("cookie-consent-accept");
    await expect(reject).toBeVisible();
    await expect(accept).toBeVisible();
    const rejectClass = await reject.getAttribute("class");
    const acceptClass = await accept.getAttribute("class");
    expect(rejectClass).toBeTruthy();
    expect(rejectClass).toBe(acceptClass);
    expect(rejectClass).toContain("primary");
  });

  test("opengraph image returns image/png", async ({ request }) => {
    const response = await request.get("/opengraph-image");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  });
});
