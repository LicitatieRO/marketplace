import { test, expect } from '@playwright/test';
const property = '10000000-0000-4000-8000-000000000001';
const sale = '20000000-0000-4000-8000-000000000001', rent = '30000000-0000-4000-8000-000000000001';
test('public comparison links sale/rent with clear units and native keyboard controls', async ({ page }, testInfo) => {
  const english = testInfo.project.name === 'mobile';
  await page.addInitScript((english) => {
    localStorage.setItem('licitatiero-language', english ? 'en' : 'ro');
    localStorage.setItem('licitatiero-theme', english ? 'dark' : 'light');
    localStorage.setItem('licitatiero-optional-content', 'rejected');
  }, english);
  await page.goto(`/compare?property=${property}`);
  await expect(page.getByRole('heading', { level: 1, name: english ? 'Compare listings' : 'Compară locuințe' })).toBeVisible();
  await expect(page.getByTestId('linked-comparison')).toContainText(english ? 'same physical property' : 'aceeași proprietate fizică');
  const table = page.getByTestId('comparison-table');
  await expect(table).toBeVisible();
  await expect(page.getByTestId('comparison-price')).toContainText(english ? '/ month' : '/ lună');
  await expect(page.getByTestId('comparison-price')).toContainText('total');
  await expect(page.getByText('POC / Simulare', { exact: true }).first()).toBeVisible();
  const first = page.getByLabel(english ? 'Listing 1' : 'Anunț 1', { exact: true });
  await first.focus();
  await expect(first).toBeFocused();
  await first.selectOption(rent);
  await page.getByLabel(english ? 'Listing 2' : 'Anunț 2', { exact: true }).selectOption(sale);
  await page.getByRole('button', { name: english ? 'Compare' : 'Compară', exact: true }).click();
  await expect(page).toHaveURL(/ids=/);
  expect(new URL(page.url()).searchParams.getAll('ids').filter(Boolean)).toEqual([rent, sale]);
  await expect(page.getByTestId('comparison-table')).toBeVisible();
  await expect(page.getByTestId('linked-comparison')).toBeVisible();
  const width = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(width.content).toBeLessThanOrEqual(width.viewport + 1);
});
test('invalid public selection has no comparison table or implicit fallback', async ({ page }) => {
  await page.goto('/compare?ids=bad,ids');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(/invalid|nu este valid/);
  await expect(page.getByTestId('comparison-table')).toHaveCount(0);
});
