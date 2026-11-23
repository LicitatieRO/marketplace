import { expect, test } from "@playwright/test";

test.describe("auth/legal POC (configured backend)", () => {
  test.skip(
    process.env.E2E_BACKEND !== "1",
    "Requires the configured local Supabase backend",
  );

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-language", "ro");
      localStorage.setItem("licitatiero-theme", "light");
      localStorage.setItem("licitatiero-optional-content", "rejected");
    });
  });

  test("persistent POC banner and legal pages render", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("poc-simulation-banner")).toBeVisible();
    await page.goto("/legal/terms");
    await expect(
      page.getByRole("heading", { name: "Termeni de utilizare (POC)" }),
    ).toBeVisible();
    await page.goto("/legal/privacy");
    await expect(
      page.getByRole("heading", { name: "Politica de confidențialitate (POC)" }),
    ).toBeVisible();
    await page.goto("/legal/cookies");
    await expect(
      page.getByRole("heading", { name: "Politica de cookie-uri (POC)" }),
    ).toBeVisible();
  });

  test("cookie consent defaults to necessary-only storage", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("licitatiero-optional-content");
    });
    await page.goto("/");
    await expect(page.getByTestId("cookie-consent-banner")).toBeVisible();
    await page.getByRole("button", { name: "Doar necesare" }).click();
    await expect(page.getByTestId("cookie-consent-banner")).toHaveCount(0);
    const stored = await page.evaluate(() =>
      localStorage.getItem("licitatiero-optional-content"),
    );
    expect(stored).toBe("rejected");
  });

  test("cookie preferences reopens banner and allows withdrawing consent", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("licitatiero-optional-content");
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Accept conținutul opțional" }).click();
    await expect(page.getByTestId("cookie-consent-banner")).toHaveCount(0);
    await page.getByTestId("cookie-preferences-control").click();
    await expect(page.getByTestId("cookie-consent-banner")).toBeVisible();
    await page.getByRole("button", { name: "Doar necesare" }).click();
    await expect(page.getByTestId("cookie-consent-banner")).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        localStorage.getItem("licitatiero-optional-content"),
      ),
    ).toBe("rejected");
  });

  test("guest listing CTA reaches sign-in with returnTo path", async ({
    page,
  }) => {
    test.skip(
      !process.env.E2E_BUYER_EMAIL ||
        !(process.env.E2E_BUYER_PASSWORD || process.env.E2E_PASSWORD),
      "Set local buyer test credentials",
    );
    const listingId = "20000000-0000-4000-8000-000000000001";
    const listingPath = `/listings/${listingId}`;
    await page.goto(
      `/account?mode=login&next=${encodeURIComponent(listingPath)}`,
    );
    await page
      .getByLabel("Adresa de email")
      .fill(process.env.E2E_BUYER_EMAIL!);
    await page
      .getByLabel("Parola", { exact: true })
      .fill((process.env.E2E_BUYER_PASSWORD || process.env.E2E_PASSWORD)!);
    await page
      .getByRole("button", { name: "Intră în cont", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${listingPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  });

  test("guest browses catalogue then sees sign-in on participate action", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "Participate CTA sits in the fixed offer sidebar, hidden on narrow viewports",
    );
    test.setTimeout(60_000);
    const listingId = "20000000-0000-4000-8000-000000000001";
    await page.goto("/");
    await page.context().clearCookies();
    const origin = process.env.APP_URL || "http://localhost:3000";
    await page.request.post(`${origin}/api/auth`, {
      headers: { Origin: origin, "Content-Type": "application/json" },
      data: { action: "logout" },
    });
    const listingPayload = await page.request.get(`/api/listings/${listingId}`);
    expect(listingPayload.ok()).toBeTruthy();
    const listingBody = (await listingPayload.json()) as {
      data?: { auction_id?: string | null };
    };
    expect(listingBody.data?.auction_id).toBeTruthy();
    await page
      .getByRole("textbox", { name: /Caută după cartier/i })
      .fill("Floreasca");
    await page.locator(".property-card").first().click();
    await expect(page).toHaveURL(new RegExp(`/listings/${listingId}`));
    await expect(page.locator(".offer-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Următorul pas" })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("listing-place-bid")).toHaveCount(0);
    const listingPath = `/listings/${listingId}`;
    const participate = page
      .locator(".offer-panel")
      .getByRole("link", { name: "Intră în cont ca să licitezi" });
    await expect(participate).toBeVisible();
    await expect(participate).toHaveAttribute(
      "href",
      new RegExp(`/account\\?mode=login&next=${encodeURIComponent(listingPath).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
    await participate.click();
    await expect(page).toHaveURL(
      new RegExp(
        `/account\\?mode=login&next=${encodeURIComponent(listingPath).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      ),
    );
    if (
      process.env.E2E_BUYER_EMAIL &&
      (process.env.E2E_BUYER_PASSWORD || process.env.E2E_PASSWORD)
    ) {
      await page
        .getByLabel("Adresa de email")
        .fill(process.env.E2E_BUYER_EMAIL);
      await page
        .getByLabel("Parola", { exact: true })
        .fill((process.env.E2E_BUYER_PASSWORD || process.env.E2E_PASSWORD)!);
      await page.getByRole("button", { name: "Intră în cont", exact: true }).click();
      await expect(page).toHaveURL(
        new RegExp(`${listingPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
      );
    }
  });

  test("POC account switcher visible with server flag and switches owner", async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env.POC_SWITCHER_ENABLED !== "true",
      "Requires POC_SWITCHER_ENABLED in the test server environment",
    );
    test.skip(
      testInfo.project.name === "mobile",
      "Signed-in header label is in the collapsed mobile menu; covered on desktop",
    );
    await page.goto("/");
    await expect(page.getByTestId("poc-account-switcher")).toBeVisible();
    const switchResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/poc/switch-account") &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Proprietar", exact: true }).click();
    expect((await switchResponse).ok()).toBe(true);
    await expect(page.getByRole("link", { name: "Spațiul meu" })).toBeVisible();
  });

  test("POST /api/poc/switch-account returns 404 when switcher disabled", async ({
    request,
  }) => {
    test.skip(
      process.env.POC_SWITCHER_ENABLED === "true",
      "This CI job enables the switcher; gate is covered by unit tests",
    );
    const origin = process.env.APP_URL || "http://localhost:3000";
    const response = await request.post("/api/poc/switch-account", {
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
      },
      data: { persona: "owner" },
    });
    expect(response.status()).toBe(404);
  });
});

test.describe("auth/legal POC (demo catalogue)", () => {
  test.skip(
    process.env.E2E_BACKEND === "1",
    "Demo-only checks without a configured backend",
  );

  test("POC account switcher is absent without the server flag", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("poc-account-switcher")).toHaveCount(0);
  });
});
