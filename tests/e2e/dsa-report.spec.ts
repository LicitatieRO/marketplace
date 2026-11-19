import { expect, test } from '@playwright/test';

test.skip(process.env.E2E_BACKEND !== '1', 'Requires disposable local Auth/database');

test('DSA notice submission and report form smoke', async ({ page, request }, testInfo) => {
  const english = testInfo.project.name === 'mobile';
  const origin = String(testInfo.project.use.baseURL);
  await page.addInitScript((useEnglish) => {
    localStorage.setItem('licitatiero-language', useEnglish ? 'en' : 'ro');
    localStorage.setItem('licitatiero-theme', 'light');
  }, english);
  const catalogue = await request.get('/api/catalogue');
  expect(catalogue.ok()).toBeTruthy();
  const listings = (await catalogue.json()).data as { id: string }[];
  expect(listings.length).toBeGreaterThan(0);
  const listingId = listings[0]!.id;
  const response = await request.post('/api/dsa-notices', {
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    data: {
      listing_id: listingId,
      element: 'description',
      reason: 'fraud',
      explanation:
        'The description appears misleading about floor area and legal encumbrances on the property.',
      notifier_name: 'E2E Reporter',
      notifier_email: 'e2e-reporter@example.test',
      good_faith: true,
    },
  });
  expect(response.ok()).toBeTruthy();
  const receipt = (await response.json()).data as { id: string };
  expect(receipt.id).toMatch(/^[0-9a-f-]{36}$/i);
  await page.goto(`/listings/${listingId}/report`);
  await expect(page.getByTestId('dsa-report-form')).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: english ? 'Submit notice' : 'Trimite notificarea',
      exact: true,
    }),
  ).toBeAttached();
  await expect(
    page.getByRole('heading', {
      name: /Report illegal content|Raportează conținut ilegal/,
    }),
  ).toBeVisible();
});
