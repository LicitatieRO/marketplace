import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const finishCalls: { p_delivered: boolean }[] = [];

vi.mock('@/lib/config', () => ({
  supabaseConfig: () => ({ url: 'http://127.0.0.1:54321', key: 'public-anon-key' }),
  isConfigured: () => true,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (name: string, params?: { p_delivered?: boolean }) => {
      if (name === 'finish_notification' && params) finishCalls.push({ p_delivered: params.p_delivered === true });
      if (name === 'close_expired_auctions') return Promise.resolve({ data: null, error: null });
      if (name === 'claim_notifications') return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: true, error: null });
    },
  }),
}));

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  finishCalls.length = 0;
  vi.unstubAllEnvs();
});

async function callCron(extraHeaders: Record<string, string> = {}) {
  const { GET } = await import('@/app/api/cron/notifications/route');
  const request = new Request('https://licitatiero-staging.vercel.app/api/cron/notifications', {
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET}`,
      host: 'licitatiero-staging.vercel.app',
      ...extraHeaders,
    },
  });
  return GET(request);
}

describe('notification cron route', () => {
  it('returns 503 on production when delivery is unavailable and never marks delivered', async () => {
    process.env.CRON_SECRET = 'cron-test-secret';
    process.env.SUPABASE_SECRET_KEY = 'service-key';
    process.env.VERCEL_ENV = 'production';
    process.env.APP_URL = 'https://licitatiero.ro';
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_DELIVERY_MODE;
    vi.stubEnv('NODE_ENV', 'production');

    const response = await callCron();
    expect(response.status).toBe(503);
    expect(finishCalls.some((c) => c.p_delivered)).toBe(false);
  });

  it('allows staging outbox on production allowlisted host with explicit flag', async () => {
    process.env.CRON_SECRET = 'cron-test-secret';
    process.env.SUPABASE_SECRET_KEY = 'service-key';
    process.env.VERCEL_ENV = 'production';
    process.env.APP_URL = 'https://licitatiero-staging.vercel.app';
    process.env.EMAIL_DELIVERY_MODE = 'staging_outbox';
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;

    const response = await callCron();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.delivery_mode).toBe('staging_outbox');
  });
});