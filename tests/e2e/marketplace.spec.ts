import { expect, test } from "@playwright/test";
test.skip(
  process.env.E2E_BACKEND === "1",
  "Demo catalogue suite; use authenticated suite for a configured backend",
);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("licitatiero-language", "ro");
    localStorage.setItem("licitatiero-theme", "light");
  });
});
test("catalogue searches and filters real sale and rental listings", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Locul tău",
  );
  await expect(page.locator(".property-card")).toHaveCount(6);
  await page
    .getByRole("textbox", { name: "Caută după cartier sau locuință" })
    .fill("Cotroceni");
  await expect(page.locator(".property-card")).toHaveCount(1);
  await page
    .getByRole("textbox", { name: "Caută după cartier sau locuință" })
    .fill("");
  await page.getByRole("tab", { name: "Închiriază" }).click();
  await page.getByLabel("Buget maxim", { exact: true }).selectOption("700");
  await expect(page.locator(".property-card")).toHaveCount(1);
  await expect(page.locator(".property-card")).toContainText("Tineretului");
  await expect(page.locator(".property-card")).toContainText("/ lună");
  await page.getByRole("button", { name: /^Filtre/ }).click();
  await page.getByLabel("Cartier", { exact: true }).selectOption("Cotroceni");
  await expect(
    page.getByRole("heading", { name: "Locul potrivit merită căutat." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resetează filtrele", exact: true })
    .click();
  await expect(page.locator(".property-card")).toHaveCount(6);
});
test("detail separates confidential offers and invitation access", async ({
  page,
}) => {
  await page.goto("/listings/20000000-0000-4000-8000-000000000003");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Viața");
  await expect(
    page.getByText("Doar cu invitație", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Valoarea ofertelor este confidențială.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Oferta publică actuală")).toHaveCount(0);
  await expect(
    page.getByText("Tur virtual: nu a fost furnizat de proprietar."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Deschide galeria foto" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".gallery-controls")).toContainText("2 / 3");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("demo is honest about authentication and persistence", async ({
  page,
}) => {
  await page.goto("/account");
  test.skip(
    !(await page.locator(".demo-banner").count()),
    "Configured backend: covered by authenticated smoke tests",
  );
  await expect(
    page.getByText("Acesta este un catalog demonstrativ.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Intră în cont", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Creează un cont", exact: true })
    .click();
  await expect(page.getByLabel("Numele tău")).toBeDisabled();
  await page.getByRole("button", { name: "Înapoi la autentificare" }).click();
  await page.getByRole("button", { name: "Ai uitat parola?" }).click();
  await expect(
    page.getByRole("button", { name: "Trimite linkul de recuperare" }),
  ).toBeDisabled();
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Spațiul tău",
  );
  await expect(
    page.getByText("Catalogul demonstrativ îți arată produsul.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("language and theme choices persist across navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Schimbă limba în engleză" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Your next chapter",
  );
  await page
    .getByRole("button", { name: "Theme: light. Change theme" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("link", { name: "A quiet corner of old Bucharest", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A quiet corner of old Bucharest",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("mobile navigation and content stay within viewport", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-specific navigation");
  await page.goto("/");
  await page.getByRole("button", { name: "Deschide meniul" }).click();
  await page
    .locator(".mobile-navigation")
    .getByRole("link", { name: "Pentru proprietari" })
    .click();
  await expect(page).toHaveURL(/workspace\?tab=owner/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("sale detail displays public offer and total asking price", async ({
  page,
}) => {
  await page.goto("/listings/20000000-0000-4000-8000-000000000001");
  await expect(
    page.getByText("Oferta publică actuală", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("EUR · preț total", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Localizare aproximativă", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hai să vorbim despre asta." }),
  ).toBeVisible();
});
