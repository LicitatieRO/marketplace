import { test, expect } from '@playwright/test';

const id = '20000000-0000-4000-8000-000000000001';
const serverMs = Date.parse('2026-11-16T06:00:00Z');
const iso = (offset: number) => new Date(serverMs + offset).toISOString();
test.use({ reducedMotion: 'reduce' });

for (const language of ['ro', 'en'] as const) {
  test(`server clock and extended deadline stay honest in ${language}`, async ({ page }) => {
    await page.addInitScript((language) => {
      localStorage.setItem('licitatiero-language', language);
      localStorage.setItem('licitatiero-theme', language === 'en' ? 'dark' : 'light');
      localStorage.setItem('licitatiero-optional-content', 'rejected');
    }, language);
    const source = await page.request.get(`/api/listings/${id}`);
    expect(source.ok()).toBe(true);
    const original = (await source.json()).data;
    expect(Boolean(original?.auction_id)).toBe(true);
    let reads = 0;
    await page.route(`**/api/listings/${id}`, async (route) => {
      const extended = reads++ > 0;
      await route.fulfill({ json: { data: { ...original, server_now: iso(extended ? 15_000 : 0), starts_at: iso(-60_000), ends_at: iso(extended ? 180_000 : 120_000), soft_close_seconds: 120, initial_ends_at: iso(120_000), max_ends_at: iso(1_920_000) } } });
    });
    // A wildly wrong client Date must not turn the server's live auction into a closed one.
    await page.clock.install({ time: new Date('2099-01-01T00:00:00Z') });
    await page.goto(`/listings/${id}`);
    const clock = page.getByTestId('auction-countdown');
    await expect(clock).toHaveAttribute('data-phase', 'live');
    await expect(clock).toHaveAttribute('data-ends-at', iso(120_000));
    await expect(clock).not.toHaveAttribute('aria-live');
    const rule = page.getByTestId('auction-close-rule');
    await expect(rule).toContainText(language === 'en' ? 'final 120s' : 'ultimele 120 s');
    await expect(rule).toContainText(language === 'en' ? 'up to' : 'cel mult până la');
    await page.clock.fastForward(15_100);
    await expect(clock).toHaveAttribute('data-ends-at', iso(180_000));
    await expect(clock).toHaveAttribute('data-phase', 'live');
  });
}

test('unavailable clock removes live participation until a successful sync', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('licitatiero-language', 'en');
    localStorage.setItem('licitatiero-optional-content', 'rejected');
  });
  const source = await page.request.get(`/api/listings/${id}`);
  const original = (await source.json()).data;
  let unavailable = false;
  await page.route(`**/api/listings/${id}`, async (route) => {
    if (unavailable) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    return route.fulfill({ json: { data: { ...original, server_now: iso(0), starts_at: iso(-60_000), ends_at: iso(120_000), soft_close_seconds: 0 } } });
  });
  await page.clock.install();
  await page.goto(`/listings/${id}`);
  const clock = page.getByTestId('auction-countdown');
  await expect(clock).toHaveAttribute('data-phase', 'live');
  await expect(page.getByTestId('listing-guest-bid-login')).toBeVisible();
  await expect(page.getByTestId('auction-close-rule')).toContainText('Fixed deadline');
  unavailable = true;
  await page.clock.fastForward(15_100);
  await expect(clock).toHaveAttribute('data-phase', 'loading');
  await expect(page.getByTestId('listing-guest-bid-login')).toHaveCount(0);
  unavailable = false;
  await page.clock.fastForward(15_100);
  await expect(clock).toHaveAttribute('data-phase', 'live');
});
