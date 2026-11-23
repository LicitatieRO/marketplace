import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderOwnerStatementOfReasons } from '@/lib/dsa-notice-templates';

vi.mock('server-only', () => ({}));

const submitDsaNotice = vi.fn();
const enforceAuthHttpRateLimit = vi.fn(async () => null);

vi.mock('@/lib/server/dsa-notices-db', () => ({
  submitDsaNotice,
  isServiceRoleConfigured: () => true,
}));

vi.mock('@/lib/server/auth-rate-limit', () => ({
  enforceAuthHttpRateLimit,
}));

vi.mock('@/lib/server/notifications-db', () => ({
  isServiceRoleConfigured: () => true,
}));

const LISTING_ID = '20000000-0000-4000-8000-000000000001';
const env = process.env;

afterEach(() => {
  process.env = { ...env };
  submitDsaNotice.mockReset();
  enforceAuthHttpRateLimit.mockClear();
  vi.resetModules();
});

describe('POST /api/dsa-notices', () => {
  it('derives listing_url server-side and ignores a client-supplied URL', async () => {
    process.env.APP_URL = 'https://licitatiero.test';
    submitDsaNotice.mockResolvedValue({
      id: '30000000-0000-4000-8000-000000000003',
      listing_url: `https://licitatiero.test/listings/${LISTING_ID}`,
      created_at: '2026-11-19T09:00:00.000Z',
    });
    const { POST } = await import('@/app/api/dsa-notices/route');
    const response = await POST(
      new Request(`https://licitatiero.test/api/dsa-notices`, {
        method: 'POST',
        headers: {
          Origin: 'https://licitatiero.test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listing_id: LISTING_ID,
          listing_url: 'https://attacker.test/fake-listing',
          element: 'description',
          reason: 'fraud',
          explanation: 'The listing misstates ownership and requests advance payment off-platform.',
          notifier_name: 'Alex Reporter',
          notifier_email: 'alex@example.test',
          good_faith: true,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(submitDsaNotice).toHaveBeenCalledTimes(1);
    const input = submitDsaNotice.mock.calls[0]?.[0];
    expect(input.listing_url).toBe(`https://licitatiero.test/listings/${LISTING_ID}`);
    expect(input.listing_url).not.toContain('attacker.test');
    const statement = renderOwnerStatementOfReasons({
      listingUrl: input.listing_url,
      decision: 'content_removed',
      dateIso: '2026-11-19T09:00:00.000Z',
      facts: 'Photos were copied from a third-party brokerage website.',
      groundType: 'legal',
      ground: 'Law',
      automated: false,
      followedNotice: true,
    });
    expect(statement.en).toContain(`https://licitatiero.test/listings/${LISTING_ID}`);
    expect(statement.en).not.toContain('attacker.test');
  });

  it('returns an allowlisted message when the explanation is too short', async () => {
    const { POST } = await import('@/app/api/dsa-notices/route');
    const response = await POST(
      new Request('https://licitatiero.test/api/dsa-notices', {
        method: 'POST',
        headers: {
          Origin: 'https://licitatiero.test',
          'Content-Type': 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify({
          listing_id: LISTING_ID,
          element: 'description',
          reason: 'fraud',
          explanation: 'too short',
          notifier_name: 'Alex Reporter',
          notifier_email: 'alex@example.test',
          good_faith: true,
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Your explanation must be at least 30 characters.',
    });
    expect(submitDsaNotice).not.toHaveBeenCalled();
  });

  it('returns an allowlisted message for an invalid notifier email', async () => {
    const { POST } = await import('@/app/api/dsa-notices/route');
    const response = await POST(
      new Request('https://licitatiero.test/api/dsa-notices', {
        method: 'POST',
        headers: {
          Origin: 'https://licitatiero.test',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listing_id: LISTING_ID,
          element: 'description',
          reason: 'fraud',
          explanation: 'The listing misstates ownership and requests advance payment off-platform.',
          notifier_name: 'Alex Reporter',
          notifier_email: 'not-an-email',
          good_faith: true,
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Enter a valid email address.' });
  });
});
