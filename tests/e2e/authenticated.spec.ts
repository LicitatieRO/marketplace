import { expect, test } from "@playwright/test";
import { assertLocalAuctionFixtureTargets, expireLocalAuctionFixture } from './helpers/local-auction-fixture';
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
test("registration submits to real Auth and asks for email verification", async ({
  page,
}, testInfo) => {
  await page.goto("/account");
  await expect(page.getByTestId("poc-simulation-banner")).toBeVisible();
  await page
    .getByRole("button", { name: "Creează un cont", exact: true })
    .click();
  await page.getByLabel("Numele tău").fill("Browser Test");
  await page
    .getByLabel("Adresa de email")
    .fill(`browser-${testInfo.project.name}-${Date.now()}@example.test`);
  await page
    .getByLabel("Parola", { exact: true })
    .fill("Local-browser-test-2026!");
  await page
    .locator(".checkbox-row input[type='checkbox']")
    .scrollIntoViewIfNeeded();
  await page.locator(".checkbox-row input[type='checkbox']").check();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Creează contul", exact: true })
    .click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  await expect(
    page.locator(".feedback.success").filter({ hasText: "Verifică emailul" }),
  ).toBeVisible();
});
test("owner signs in, creates linked listings, edits property, and signs out", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.E2E_OWNER_EMAIL ||
      !(process.env.E2E_OWNER_PASSWORD || process.env.E2E_PASSWORD),
    "Set local owner test credentials",
  );
  test.setTimeout(60000);
  await page.goto("/account");
  await page.getByLabel("Adresa de email").fill(process.env.E2E_OWNER_EMAIL!);
  await page
    .getByLabel("Parola", { exact: true })
    .fill((process.env.E2E_OWNER_PASSWORD || process.env.E2E_PASSWORD)!);
  await page
    .getByRole("button", { name: "Intră în cont", exact: true })
    .click();
  await expect(page).toHaveURL(/workspace/);
  await page.getByRole("button", { name: /Sunt proprietar/ }).click();
  await page.getByRole("button", { name: "Adaugă o proprietate" }).click();
  const title = `Locuință browser ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Titlul anunțului").fill(title);
  await page.getByLabel("Cartier", { exact: true }).fill("Bucureștii Noi");
  await page
    .getByLabel("Adresa exactă · privată")
    .fill("Adresă de test privată 45");
  await page.getByLabel("Suprafață utilă, m²").fill("70");
  await page.getByLabel("Camere", { exact: true }).fill("3");
  await page.getByLabel("Anul construcției").fill("2020");
  await page
    .getByLabel("Descriere", { exact: true })
    .fill(
      "Locuință de test browser cu trei camere, lumină naturală și spațiu generos.",
    );
  await page.getByLabel("Preț total de vânzare, EUR").fill("180000");
  await page.getByLabel("Chirie lunară, EUR").fill("850");
  await page
    .getByLabel("Fotografii · un URL HTTPS pe linie")
    .fill(
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=85",
    );
  await page.getByRole("button", { name: "Publică proprietatea" }).click();
  const property = page
    .locator(".owned-property")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await expect(property).toBeVisible();
  await expect(property.locator(".owned-listings>div")).toHaveCount(2);
  await property.getByRole("button", { name: "Editează proprietatea" }).click();
  await page.getByLabel("Titlul anunțului").fill(`${title} actualizată`);
  await page.getByRole("button", { name: "Salvează proprietatea" }).click();
  await expect(
    page.getByRole("heading", { name: `${title} actualizată`, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: `${title} actualizată`, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Contul meu", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Un plus de siguranță" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ieși din cont" }).click();
  await expect(
    page.getByRole("heading", { name: "Intră în cont", exact: true }),
  ).toBeVisible();
});
test("buyer bids, messages, views, saves, and confirms a simulated reservation", async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Run transaction journey once against the shared database",
  );
  test.skip(
    !process.env.E2E_OWNER_EMAIL ||
      !process.env.E2E_BUYER_EMAIL ||
      !process.env.E2E_PASSWORD,
    "Set local owner and buyer credentials",
  );
  test.setTimeout(60000);
  const origin = String(testInfo.project.use.baseURL);
  assertLocalAuctionFixtureTargets(origin, process.env.DATABASE_URL || '');
  const headers = { Origin: origin };
  const login = await request.post("/api/auth", {
    headers,
    data: {
      action: "login",
      email: process.env.E2E_OWNER_EMAIL,
      password: process.env.E2E_PASSWORD,
    },
  });
  expect(login.status()).toBe(200);
  const created = await request.post("/api/marketplace", {
    headers,
    data: {
      action: "create_property",
      payload: {
        p_title: `Browser buyer journey ${Date.now()}`,
        p_description:
          "A browser transaction fixture with clear ownership and no actual payment.",
        p_neighborhood: "Bucureștii Noi",
        p_exact_address: "Private browser fixture address",
        p_property_type: "apartment",
        p_area_sqm: 70,
        p_rooms: 3,
        p_floor: 2,
        p_built_year: 2020,
        p_sale_price_minor: 10000000,
        p_rent_price_minor: null,
        p_image_urls: [
          "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=85",
        ],
      },
    },
  });
  expect(created.status()).toBe(200);
  const property = (await created.json()).data;
  const catalogue = (await (await request.get("/api/catalogue")).json()).data;
  const listing = catalogue.find(
    (item: { property_id: string }) => item.property_id === property.id,
  );
  expect(listing).toBeTruthy();
  const endsAt = Date.now() + 20000;
  const auctionResponse = await request.post("/api/marketplace", {
    headers,
    data: {
      action: "start_auction",
      payload: {
        p_listing_id: listing.id,
        p_mode: "ascending",
        p_access: "public",
        p_starts_at: new Date(Date.now() - 1000).toISOString(),
        p_ends_at: new Date(endsAt).toISOString(),
        p_starting_price_minor: 10000000,
        p_min_increment_minor: 10000,
      },
    },
  });
  expect(auctionResponse.status()).toBe(200);
  const auction = (await auctionResponse.json()).data;
  await page.goto("/account");
  await page.getByLabel("Adresa de email").fill(process.env.E2E_BUYER_EMAIL!);
  await page
    .getByLabel("Parola", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page
    .getByRole("button", { name: "Intră în cont", exact: true })
    .click();
  await expect(page).toHaveURL(/workspace/);
  await page.goto(`/listings/${listing.id}`);
  await expect(page.getByTestId("auction-countdown")).toHaveAttribute(
    "data-phase",
    "live",
  );
  await expect(page.getByTestId("listing-place-bid")).toBeVisible();
  await page.getByTestId("listing-bid-amount").fill("100100");
  await page.getByTestId("listing-place-bid").click();
  await page.getByTestId("listing-bid-confirm").click();
  await expect(
    page
      .locator(".feedback.success")
      .filter({ hasText: "Oferta (simulare) a fost înregistrată" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Salvată", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Mesaj pentru proprietar")
    .fill("Bună, aș dori detalii despre această locuință.");
  await page
    .getByRole("button", { name: "Trimite mesajul", exact: true })
    .click();
  await expect(
    page.locator(".feedback.success").filter({ hasText: "Mesaj trimis" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Programează o vizionare" }).click();
  await page
    .getByLabel("Data și ora preferată")
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  await page
    .getByLabel("Mesaj pentru proprietar")
    .fill("Aș dori să vizitez mâine, vă rog.");
  await page.getByRole("button", { name: "Solicită vizionarea" }).click();
  await expect(
    page
      .locator(".feedback.success")
      .filter({ hasText: "Cererea de vizionare a fost trimisă" }),
  ).toBeVisible();
  const afterBid = (await (await request.get(`/api/listings/${listing.id}`)).json()).data;
  expect(Date.parse(afterBid.ends_at)).toBeGreaterThan(endsAt);
  // Verify the real extension, then advance only this owned local fixture for the
  // reservation half of the journey instead of waiting 120 seconds on every CI run.
  await expireLocalAuctionFixture(origin, { auctionId: auction.id, propertyId: property.id, ownerId: auction.owner_id });
  const ownerWorkspace = (await (await request.get("/api/workspace")).json())
    .data;
  const bid = ownerWorkspace.bids.find(
    (item: { auction_id: string }) => item.auction_id === auction.id,
  );
  expect(bid).toBeTruthy();
  const reservationResponse = await request.post("/api/marketplace", {
    headers,
    data: {
      action: "request_reservation",
      payload: {
        p_bid_id: bid.id,
        p_deposit_minor: 25000,
        p_idempotency_key: crypto.randomUUID(),
      },
    },
  });
  expect(reservationResponse.status()).toBe(200);
  const reservation = (await reservationResponse.json()).data;
  await page.goto("/workspace");
  const reservationCard = page
    .locator(".reservation-card")
    .filter({ hasText: reservation.id.slice(-6) });
  await expect(reservationCard).toBeVisible();
  await reservationCard
    .getByRole("button", { name: "Simulează finanțarea" })
    .click();
  await expect(reservationCard).toContainText("Finanțată (simulare)");
  await reservationCard
    .getByRole("button", {
      name: "Confirm semnarea simulată — nu este arvună și nu transferă proprietatea",
    })
    .click();
  await expect(
    reservationCard.getByRole("button", {
      name: "Confirmat · așteaptă cealaltă parte",
    }),
  ).toBeDisabled();
  const signed = await request.post("/api/marketplace", {
    headers,
    data: {
      action: "advance_reservation",
      payload: {
        p_reservation_id: reservation.id,
        p_action: "sign",
        p_idempotency_key: crypto.randomUUID(),
      },
    },
  });
  expect(signed.status()).toBe(200);
  await page.reload();
  await expect(
    page
      .locator(".reservation-card")
      .filter({ hasText: reservation.id.slice(-6) }),
  ).toContainText("Ambele părți au confirmat semnarea.");
});
