import { MAP_BOUNDS_DEBOUNCE_MS } from "@/lib/map-bounds-query";
import { expect, test, type Page } from "@playwright/test";

/** Debounced quiet periods after pan/zoom (each step waits one bounds debounce). */
const MAP_LISTINGS_STABILITY_DEBOUNCE_STEPS = 3;

/** After mobile map idle: mount default bbox + one map viewport fetch. */
const MOBILE_MAP_FIRST_LOAD_LISTINGS_REQUESTS = 2;

const LISTINGS_MAP_MIN_ZOOM = 6;

const TILE_URL_PATTERN =
  /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/;

async function prepareMapPage(page: Page) {
  await page.route("**/*tile.openstreetmap.org/**", async (route) => {
    if (TILE_URL_PATTERN.test(route.request().url())) {
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
      return;
    }
    await route.abort("blockedbyclient");
  });
  await page.addInitScript(() => {
    localStorage.setItem("licitatiero-optional-content", "rejected");
    localStorage.setItem("licitatiero-language", "ro");
  });
}

async function openListingsMapWithConsent(page: Page) {
  await page.goto("/map");
  await expect(page.getByTestId("listings-map-page")).toBeVisible();
  const accept = page.getByTestId("listings-map-accept");
  if (await accept.isVisible()) {
    await accept.click();
  }
  await expect(page.getByTestId("listings-map-interactive")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator(".leaflet-container")).toHaveCount(1);
}

function trackMapListingsApi(page: Page) {
  const mapApi: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/map/listings")) {
      mapApi.push(req.url());
    }
  });
  return mapApi;
}

async function readRevision(page: Page): Promise<number> {
  return Number(
    (await page
      .getByTestId("listings-map-interactive")
      .getAttribute("data-map-bounds-settled-revision")) ?? "0",
  );
}

async function readMapZoom(page: Page): Promise<number> {
  return Number(
    (await page
      .getByTestId("listings-map-interactive")
      .getAttribute("data-map-zoom")) ?? "0",
  );
}

async function waitForMapBoundsIdle(page: Page, minRevision: number) {
  await expect
    .poll(async () => readRevision(page), {
      timeout: 20_000,
      intervals: [50, 150, 350],
    })
    .toBeGreaterThanOrEqual(minRevision);
}

async function waitForZoomOutDisabled(page: Page) {
  const zoomOut = page.locator(".leaflet-control-zoom-out");
  await expect
    .poll(async () => zoomOut.isDisabled(), {
      timeout: 20_000,
      intervals: [50, 150, 350],
    })
    .toBe(true);
  const settledRevision = await readRevision(page);
  await waitForMapBoundsIdle(page, settledRevision);
}

async function expectMapListingsQuietForDebounceSteps(
  page: Page,
  mapApi: string[],
  baselineRequestCount: number,
  baselineRevision: number,
) {
  for (let step = 0; step < MAP_LISTINGS_STABILITY_DEBOUNCE_STEPS; step += 1) {
    expect(mapApi.length).toBe(baselineRequestCount);
    expect(await readRevision(page)).toBe(baselineRevision);
    if (step < MAP_LISTINGS_STABILITY_DEBOUNCE_STEPS - 1) {
      await page.waitForTimeout(MAP_BOUNDS_DEBOUNCE_MS);
    }
  }
}

async function panListingsMap(page: Page) {
  const mapBox = page.locator(".leaflet-container").first();
  await expect(mapBox).toBeVisible();
  const box = await mapBox.boundingBox();
  expect(box).toBeTruthy();
  const startX = box!.width / 2;
  const startY = box!.height / 2;
  await mapBox.dragTo(mapBox, {
    sourcePosition: { x: startX, y: startY },
    targetPosition: { x: startX + 120, y: startY },
    force: true,
  });
}

async function zoomInSteps(page: Page, steps: number) {
  const zoomIn = page.locator(".leaflet-control-zoom-in");
  for (let i = 0; i < steps; i += 1) {
    if (await zoomIn.isDisabled()) break;
    const revisionBeforeClick = await readRevision(page);
    await zoomIn.click({ force: true });
    await waitForMapBoundsIdle(page, revisionBeforeClick + 1);
  }
}

async function zoomOutUntilMinOrMaxClicks(
  page: Page,
  maxClicks: number,
): Promise<{ zoomOut: ReturnType<Page["locator"]>; zoomClicks: number }> {
  const zoomOut = page.locator(".leaflet-control-zoom-out");
  let zoomClicks = 0;
  while (zoomClicks < maxClicks && !(await zoomOut.isDisabled())) {
    const revisionBeforeClick = await readRevision(page);
    await zoomOut.click({ force: true });
    zoomClicks += 1;
    await waitForMapBoundsIdle(page, revisionBeforeClick + 1);
  }
  if (!(await zoomOut.isDisabled())) {
    await waitForZoomOutDisabled(page);
  }
  return { zoomOut, zoomClicks };
}

async function openMobileListingsMapInteractive(page: Page) {
  await prepareMapPage(page);
  await page.addInitScript(() => {
    localStorage.setItem("licitatiero-optional-content", "accepted");
  });
  await page.goto("/map");
  await expect(page.getByTestId("listings-map-page")).toBeVisible();
  const accept = page.getByTestId("listings-map-accept");
  if (await accept.isVisible()) {
    await accept.click();
  }
  await page.getByRole("button", { name: /Hartă|Map/ }).click();
  await expect(page.getByTestId("listings-map-interactive")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator(".leaflet-container")).toHaveCount(1);
}

test.describe("listings map render stability (mobile)", () => {
  test("mobile: one map instance and bounded listings API traffic", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile-only stability check");
    const mapApi = trackMapListingsApi(page);
    await openMobileListingsMapInteractive(page);

    await waitForMapBoundsIdle(page, 1);
    await expect(page.locator(".leaflet-container")).toHaveCount(1);
    expect(mapApi.length).toBe(MOBILE_MAP_FIRST_LOAD_LISTINGS_REQUESTS);
    let settledRevision = await readRevision(page);
    const firstLoadRequestCount = mapApi.length;
    await expectMapListingsQuietForDebounceSteps(
      page,
      mapApi,
      firstLoadRequestCount,
      settledRevision,
    );

    const beforePan = mapApi.length;
    const revisionBeforePan = await readRevision(page);
    await panListingsMap(page);
    await waitForMapBoundsIdle(page, revisionBeforePan + 1);
    await expect
      .poll(() => mapApi.length, { timeout: 20_000, intervals: [50, 150, 350] })
      .toBeGreaterThan(beforePan);
    expect(mapApi.length - beforePan).toBeLessThanOrEqual(2);
    settledRevision = await readRevision(page);
    const afterPanRequestCount = mapApi.length;
    await expectMapListingsQuietForDebounceSteps(
      page,
      mapApi,
      afterPanRequestCount,
      settledRevision,
    );
    await expect(page.locator(".leaflet-container")).toHaveCount(1);

    const revisionBeforeZoom = await readRevision(page);
    const mapZoomBefore = await readMapZoom(page);
    const beforeZoomOut = mapApi.length;
    const { zoomClicks } = await zoomOutUntilMinOrMaxClicks(page, 12);
    await waitForMapBoundsIdle(page, revisionBeforeZoom + 1);
    if (zoomClicks > 0) {
      await expect
        .poll(() => mapApi.length, { timeout: 20_000, intervals: [50, 150, 350] })
        .toBeGreaterThan(beforeZoomOut);
      expect(mapApi.length - beforeZoomOut).toBeLessThanOrEqual(4);
      expect(await readMapZoom(page)).toBeLessThan(mapZoomBefore);
    }
    await waitForZoomOutDisabled(page);
    settledRevision = await readRevision(page);
    const afterZoomRequestCount = mapApi.length;
    await expectMapListingsQuietForDebounceSteps(
      page,
      mapApi,
      afterZoomRequestCount,
      settledRevision,
    );
    await expect(page.locator(".leaflet-container")).toHaveCount(1);
  });
});

test.describe("listings map render stability", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMapPage(page);
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-optional-content", "accepted");
    });
  });

  test("no render loop: one map instance and bounded listings API traffic", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "Mobile stability uses narrower viewport; see listings map (logged in POC) mobile path",
    );
    test.setTimeout(60_000);
    const mapApi = trackMapListingsApi(page);
    await openListingsMapWithConsent(page);

    await waitForMapBoundsIdle(page, 1);
    const afterLoad = mapApi.length;
    let settledRevision = await readRevision(page);
    await expectMapListingsQuietForDebounceSteps(
      page,
      mapApi,
      afterLoad,
      settledRevision,
    );
    expect(mapApi.length - afterLoad).toBeLessThanOrEqual(2);
    await expect(page.locator(".leaflet-container")).toHaveCount(1);

    const beforePan = mapApi.length;
    const revisionBeforePan = await readRevision(page);
    await panListingsMap(page);
    await waitForMapBoundsIdle(page, revisionBeforePan + 1);
    await expect
      .poll(() => mapApi.length, { timeout: 20_000, intervals: [50, 150, 350] })
      .toBeGreaterThan(beforePan);
    expect(mapApi.length - beforePan).toBeLessThanOrEqual(2);
    settledRevision = await readRevision(page);
    const afterPanRequestCount = mapApi.length;
    await expectMapListingsQuietForDebounceSteps(
      page,
      mapApi,
      afterPanRequestCount,
      settledRevision,
    );

    const revisionBeforeZoom = await readRevision(page);
    await zoomInSteps(page, 2);
    await waitForMapBoundsIdle(page, revisionBeforeZoom + 1);
    const mapZoomBeforeZoomOut = await readMapZoom(page);
    const beforeZoomOut = mapApi.length;
    const { zoomOut, zoomClicks } = await zoomOutUntilMinOrMaxClicks(page, 24);
    await waitForMapBoundsIdle(page, revisionBeforeZoom + 1);
    if (zoomClicks > 0) {
      await expect
        .poll(() => mapApi.length, { timeout: 20_000, intervals: [50, 150, 350] })
        .toBeGreaterThan(beforeZoomOut);
      expect(mapApi.length - beforeZoomOut).toBeLessThanOrEqual(
        Math.min(zoomClicks, 6) + 1,
      );
      expect(await readMapZoom(page)).toBeLessThan(mapZoomBeforeZoomOut);
    }
    await waitForZoomOutDisabled(page);
    await expect(zoomOut).toBeDisabled();
    expect(await readMapZoom(page)).toBeGreaterThanOrEqual(LISTINGS_MAP_MIN_ZOOM);
    settledRevision = await readRevision(page);
    const afterZoomRequestCount = mapApi.length;
    await expectMapListingsQuietForDebounceSteps(
      page,
      mapApi,
      afterZoomRequestCount,
      settledRevision,
    );
    await expect(zoomOut).toBeDisabled();
    await expect(page.locator(".leaflet-container")).toHaveCount(1);
  });
});

test.describe("listings map (logged out)", () => {
  test.beforeEach(async ({ page }) => {
    await prepareMapPage(page);
  });

  test("list works without Leaflet; guest bid uses validated next", async ({
    page,
  }) => {
    const tileRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("tile.openstreetmap.org")) {
        tileRequests.push(req.url());
      }
    });

    await page.goto("/map");
    await expect(page.getByTestId("listings-map-page")).toBeVisible();
    await expect(page.getByTestId("listings-map-placeholder")).toBeVisible();
    expect(tileRequests).toHaveLength(0);

    const firstCard = page.locator("[data-testid^=map-list-card-]").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await firstCard.click();
    await expect(page.getByTestId("map-card-time-left")).toBeVisible();
    await expect(page.getByTestId("map-guest-bid-login")).toBeVisible();
    const href = await page.getByTestId("map-guest-bid-login").getAttribute("href");
    expect(href).toContain("/login?next=");
    expect(href).toContain(encodeURIComponent("/map?listing="));
  });

  test("mobile list/map toggle persists view= in the URL", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile URL persistence");
    await page.addInitScript(() => {
      localStorage.setItem("licitatiero-optional-content", "accepted");
    });
    await page.goto("/map");
    await page.getByTestId("listings-map-mobile-toggle").click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("view"))
      .toBe("map");
    await page.getByTestId("listings-map-mobile-toggle").click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("view"))
      .toBeNull();
  });

  test("escape closes map card and clears listing from URL", async ({
    page,
  }) => {
    await page.goto("/map");
    const firstCard = page.locator("[data-testid^=map-list-card-]").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    const listingId = (await firstCard.getAttribute("data-testid"))!.replace(
      "map-list-card-",
      "",
    );
    await firstCard.click();
    await expect(page.getByTestId("listings-map-card")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`listing=${listingId}`));
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("listings-map-card")).toHaveCount(0);
    await expect
      .poll(() => new URL(page.url()).searchParams.get("listing"))
      .toBeNull();
  });

  test("guest map API payload has no exact fields", async ({ request }) => {
    const response = await request.get(
      "/api/map/listings?west=25.9&south=44.3&east=26.3&north=44.5",
    );
    expect(response.ok()).toBe(true);
    const json = (await response.json()) as { data: Record<string, unknown>[] };
    const first = json.data[0];
    expect(first).toBeTruthy();
    expect(first).not.toHaveProperty("owner_id");
    expect(first).not.toHaveProperty("exact_address");
    const lat = String(first.approxLat);
    const lng = String(first.approxLng);
    expect(lat.includes(".") ? lat.split(".")[1].length : 0).toBeLessThanOrEqual(3);
    expect(lng.includes(".") ? lng.split(".")[1].length : 0).toBeLessThanOrEqual(3);
  });

  test("public map coords and exact-vs-public bbox", async ({ request }) => {
    const listingId = "20000000-0000-4000-8000-000000000001";
    const exactLat = 44.46463;
    const exactLng = 26.09944;
    const exactDelta = 0.00025;
    const publicDelta = 0.002;
    const broad = await request.get(
      "/api/map/listings?west=25.9&south=44.3&east=26.3&north=44.5",
    );
    const mapRow = (
      (await broad.json()) as {
        data: { id: string; approxLat: number; approxLng: number }[];
      }
    ).data.find((row) => row.id === listingId);
    expect(mapRow).toBeTruthy();
    expect(mapRow!.approxLat).not.toBe(exactLat);
    expect(mapRow!.approxLng).not.toBe(exactLng);

    const exactBbox = new URLSearchParams({
      west: String(exactLng - exactDelta),
      south: String(exactLat - exactDelta),
      east: String(exactLng + exactDelta),
      north: String(exactLat + exactDelta),
    });
    const exactRes = await request.get(`/api/map/listings?${exactBbox.toString()}`);
    const exactHits = ((await exactRes.json()) as { data: { id: string }[] }).data;
    expect(exactHits.some((row) => row.id === listingId)).toBe(false);

    const publicBbox = new URLSearchParams({
      west: String(mapRow!.approxLng - publicDelta),
      south: String(mapRow!.approxLat - publicDelta),
      east: String(mapRow!.approxLng + publicDelta),
      north: String(mapRow!.approxLat + publicDelta),
    });
    const publicRes = await request.get(`/api/map/listings?${publicBbox.toString()}`);
    const publicHits = ((await publicRes.json()) as { data: { id: string }[] }).data;
    expect(publicHits.some((row) => row.id === listingId)).toBe(true);

    if (process.env.E2E_BACKEND === "1") {
      const catalogueRes = await request.get("/api/catalogue");
      expect(catalogueRes.ok()).toBe(true);
      const catalogueRow = (
        (await catalogueRes.json()) as {
          data: { id: string; lat: number; lng: number }[];
        }
      ).data.find((row) => row.id === listingId);
      expect(catalogueRow).toBeTruthy();
      expect(catalogueRow!.lat).toBeCloseTo(mapRow!.approxLat, 3);
      expect(catalogueRow!.lng).toBeCloseTo(mapRow!.approxLng, 3);
    }
  });
});

test.describe("listings map (logged in POC)", () => {
  test.skip(
    process.env.E2E_BACKEND !== "1",
    "Requires the configured local Supabase backend",
  );
  test.skip(
    process.env.POC_SWITCHER_ENABLED !== "true",
    "Requires POC switcher for seeded session",
  );

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "Desktop map bid integration");
    await prepareMapPage(page);
    await page.goto("/map");
    const placeholder = page.getByTestId("listings-map-placeholder");
    if (await placeholder.isVisible()) {
      await page.getByTestId("listings-map-accept").click();
    }
    await expect(page.getByTestId("listings-map-interactive")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("buyer confirm-step bid and owner cannot bid", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(testInfo.project.name === "mobile", "Desktop integration path");
    const listingId = "20000000-0000-4000-8000-000000000001";

    await page.goto("/");
    const switchBuyer = page.waitForResponse(
      (response) =>
        response.url().includes("/api/poc/switch-account") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    );
    await page.getByRole("button", { name: "Cumpărător", exact: true }).click();
    expect((await switchBuyer).ok()).toBe(true);

    await page.goto(`/map?listing=${listingId}`);
    await page.getByTestId(`map-list-card-${listingId}`).click();
    await expect(page.getByTestId("listings-map-card")).toBeVisible();
    await page.getByTestId("map-place-bid").click();
    await expect(page.getByTestId("map-bid-confirm-panel")).toBeVisible();
    await page.getByTestId("map-bid-confirm").click();
    await expect(page.getByTestId("map-bid-confirm-panel")).toHaveCount(0, {
      timeout: 20_000,
    });

    const switchOwner = page.waitForResponse(
      (response) =>
        response.url().includes("/api/poc/switch-account") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Proprietar", exact: true }).click();
    expect((await switchOwner).ok()).toBe(true);
    await page.goto(`/map?listing=${listingId}`);
    await page.getByTestId(`map-list-card-${listingId}`).click();
    await expect(page.getByTestId("map-own-no-bid")).toBeVisible();
  });
});
