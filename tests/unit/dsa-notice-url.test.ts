import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const env = process.env;

afterEach(() => {
  process.env = { ...env };
});

describe('listingUrlFromRequest', () => {
  it('uses configured APP_URL and ignores a hostile request URL host', async () => {
    process.env.APP_URL = 'https://licitatiero-staging.vercel.app';
    const { listingUrlFromRequest } = await import('@/lib/dsa-notice-url');
    const id = '20000000-0000-4000-8000-000000000001';
    const url = listingUrlFromRequest(
      id,
      'https://evil.attacker.test/api/dsa-notices',
    );
    expect(url).toBe(`https://licitatiero-staging.vercel.app/listings/${id}`);
    expect(url).not.toContain('evil.attacker.test');
  });

  it('falls back to NEXT_PUBLIC_SITE_URL when APP_URL is unset', async () => {
    delete process.env.APP_URL;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.example.test';
    const { listingUrlFromRequest } = await import('@/lib/dsa-notice-url');
    const id = '20000000-0000-4000-8000-000000000002';
    expect(listingUrlFromRequest(id, 'https://evil.test/x')).toBe(
      `https://app.example.test/listings/${id}`,
    );
  });

  it('fails closed when no site origin is configured', async () => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_URL = 'evil-preview.vercel.app';
    vi.resetModules();
    const { listingUrlFromRequest } = await import('@/lib/dsa-notice-url');
    const id = '20000000-0000-4000-8000-000000000003';
    expect(() =>
      listingUrlFromRequest(id, 'https://evil-preview.vercel.app/api/dsa-notices'),
    ).toThrow('APP_URL must be configured.');
    try {
      listingUrlFromRequest(id, 'https://evil-preview.vercel.app/api/dsa-notices');
    } catch (error) {
      expect(error).toMatchObject({ status: 503, message: 'APP_URL must be configured.' });
    }
  });
});
