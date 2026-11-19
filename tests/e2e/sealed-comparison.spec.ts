import { test, expect } from '@playwright/test';
test.skip(process.env.E2E_BACKEND !== '1', 'Requires disposable local Auth/database');

test('owner compares confidential offers while bidder receives no comparison data', async ({ page, request }, testInfo) => {
  test.skip(!process.env.E2E_OWNER_EMAIL || !process.env.E2E_BUYER_EMAIL || !process.env.E2E_PASSWORD, 'Local integration credentials required');
  const language = testInfo.project.name === 'mobile' ? 'en' : 'ro';
  await page.addInitScript((language) => {
    localStorage.setItem('licitatiero-language', language);
    localStorage.setItem('licitatiero-theme', language === 'en' ? 'dark' : 'light');
    localStorage.setItem('licitatiero-optional-content', 'rejected');
  }, language);
  const headers = { Origin: String(testInfo.project.use.baseURL) };
  expect((await page.request.post('/api/auth', { headers, data: { action: 'login', email: process.env.E2E_OWNER_EMAIL, password: process.env.E2E_PASSWORD } })).status()).toBe(200);
  const created = await page.request.post('/api/marketplace', { headers, data: { action: 'create_property', payload: {
    p_title: `Sealed comparison ${testInfo.project.name} ${Date.now()}`, p_description: 'Private browser comparison fixture without actual funds.',
    p_neighborhood: 'Cotroceni', p_exact_address: 'Private comparison fixture address', p_property_type: 'apartment', p_area_sqm: 70, p_rooms: 3, p_floor: 2, p_built_year: 2020,
    p_sale_price_minor: 10000000, p_rent_price_minor: null, p_image_urls: [],
  } } });
  expect(created.status()).toBe(200);
  const property = (await created.json()).data;
  const catalogue = (await (await page.request.get('/api/catalogue')).json()).data;
  const listing = catalogue.find((item: { property_id: string }) => item.property_id === property.id);
  expect(Boolean(listing)).toBe(true);
  const started = await page.request.post('/api/marketplace', { headers, data: { action: 'start_auction', payload: {
    p_listing_id: listing.id, p_mode: 'sealed', p_access: 'public', p_starts_at: new Date(Date.now() - 1000).toISOString(), p_ends_at: new Date(Date.now() + 3600_000).toISOString(), p_starting_price_minor: 1000, p_min_increment_minor: 100,
  } } });
  expect(started.status()).toBe(200);
  const auction = (await started.json()).data;
  expect((await request.post('/api/auth', { headers, data: { action: 'login', email: process.env.E2E_BUYER_EMAIL, password: process.env.E2E_PASSWORD } })).status()).toBe(200);
  for (const amount of [40000, 50000]) {
    const bid = await request.post('/api/marketplace', { headers, data: { action: 'place_bid', payload: { p_auction_id: auction.id, p_amount_minor: amount, p_idempotency_key: crypto.randomUUID() } } });
    expect(bid.status()).toBe(200);
  }
  const denied = await request.get(`/api/auctions/${auction.id}/sealed-offers`);
  expect(denied.status()).toBe(403);
  expect((await denied.json()).data).toBeUndefined();
  expect((await (await request.get(`/api/listings/${listing.id}`)).json()).data.current_bid_minor).toBeNull();
  await page.goto('/workspace?tab=owner');
  const section = page.getByTestId(`sealed-offers-${auction.id}`);
  await expect(section).toContainText('POC / Simulare');
  const table = section.getByRole('table');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  const select = section.getByRole('combobox', { name: language === 'en' ? 'Sort confidential offers' : 'Sortează ofertele confidențiale' });
  await select.focus();
  await expect(select).toBeFocused();
  await select.selectOption('amountDesc');
  await expect(table.locator('tbody tr').first().locator('td').first()).toContainText('500');
  await select.selectOption('amountAsc');
  await expect(table.locator('tbody tr').first().locator('td').first()).toContainText('400');
  await select.selectOption('timeDesc');
  await expect(table.locator('tbody tr').first().locator('td').first()).toContainText('500');
  await select.selectOption('timeAsc');
  await expect(table.locator('tbody tr').first().locator('td').first()).toContainText('400');
  // An access failure on refresh clears previously displayed rows instead of retaining them.
  await page.route(`**/api/auctions/${auction.id}/sealed-offers`, route => route.fulfill({ status: 403, json: { error: 'Denied' } }));
  await section.getByRole('button', { name: language === 'en' ? 'Refresh offers' : 'Actualizează ofertele' }).click();
  await expect(section.getByRole('alert')).toBeVisible();
  await expect(section.getByRole('table')).toHaveCount(0);
});
