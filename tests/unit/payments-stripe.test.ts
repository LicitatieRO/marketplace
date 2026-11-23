import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestError } from '@/lib/security';
import {
  assertStripeKeysNotLive,
  extractCheckoutMetadata,
  hostnameInMockProductionAllowlist,
  mockPaymentsAllowed,
  paymentsBlockedResponse,
  paymentsCheckoutMode,
  paymentsUnavailableResponse,
  stripeLiveModeFlagBlocked,
  stripeTestConfigured,
} from '@/lib/payments/stripe-guard';
import type Stripe from 'stripe';

const baseEnv = { ...process.env };
const STAGING = 'licitatiero-staging.vercel.app';

function stagingProdEnv(overrides: Record<string, string | undefined> = {}) {
  process.env.VERCEL_ENV = 'production';
  process.env.APP_URL = `https://${STAGING}`;
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function selfHostedProdEnv(overrides: Record<string, string | undefined> = {}) {
  delete process.env.VERCEL_ENV;
  vi.stubEnv('NODE_ENV', 'production');
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_WEBHOOK_SECRET;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  process.env = { ...baseEnv };
  vi.unstubAllEnvs();
});

describe('stripe key guard', () => {
  it('rejects live secret keys fail-closed', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_deadbeef';
    expect(() => assertStripeKeysNotLive()).toThrow(RequestError);
    expect(paymentsCheckoutMode(undefined)).toBe('blocked');
  });

  it('rejects STRIPE_MODE=live', () => {
    process.env.STRIPE_MODE = 'live';
    expect(() => assertStripeKeysNotLive()).toThrow(RequestError);
    expect(stripeLiveModeFlagBlocked()).toBe(true);
  });

  it('returns unavailable when keys are missing and mock is not allowed', () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.PAYMENTS_MOCK_ENABLED;
    delete process.env.VERCEL_ENV;
    vi.stubEnv('NODE_ENV', 'development');
    expect(paymentsCheckoutMode(undefined)).toBe('unavailable');
    expect(paymentsUnavailableResponse()).toEqual({ error: 'payments_unavailable' });
    expect(paymentsBlockedResponse()).toEqual({ error: 'payments_blocked' });
  });

  it('returns mock only when explicitly enabled outside production', () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.PAYMENTS_MOCK_ENABLED = 'true';
    process.env.VERCEL_ENV = 'preview';
    vi.stubEnv('NODE_ENV', 'development');
    expect(mockPaymentsAllowed(undefined)).toBe(true);
    expect(paymentsCheckoutMode(undefined)).toBe('mock');
  });

  it('returns unavailable for partial stripe config (secret without webhook)', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.PAYMENTS_MOCK_ENABLED;
    expect(stripeTestConfigured()).toBe(false);
    expect(paymentsCheckoutMode(undefined)).toBe('unavailable');
  });

  it('detects full test configuration', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_example';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_example';
    expect(stripeTestConfigured()).toBe(true);
    expect(paymentsCheckoutMode(undefined)).toBe('stripe_test');
  });
});

describe('production mock host allowlist (fail-closed)', () => {
  it('allows prod+flag+staging APP_URL and matching request host', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true' });
    expect(paymentsCheckoutMode(STAGING)).toBe('mock');
    expect(mockPaymentsAllowed(STAGING)).toBe(true);
  });

  it('allows request host with port stripped', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true' });
    expect(paymentsCheckoutMode(`${STAGING}:443`)).toBe('mock');
  });

  it('blocks prod+flag+wrong APP_URL host', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true', APP_URL: 'https://licitatiero.ro' });
    expect(paymentsCheckoutMode(STAGING)).toBe('unavailable');
  });

  it('blocks prod+flag+good APP_URL but wrong request host', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true' });
    expect(paymentsCheckoutMode('licitatiero.ro')).toBe('unavailable');
  });

  it('blocks prod without flag on staging host', () => {
    stagingProdEnv();
    delete process.env.PAYMENTS_MOCK_ENABLED;
    expect(paymentsCheckoutMode(STAGING)).toBe('unavailable');
  });

  it('blocks PAYMENTS_MOCK_ENABLED=1 (exact true required)', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: '1' });
    expect(paymentsCheckoutMode(STAGING)).toBe('unavailable');
  });

  it('blocks lookalike hosts (no suffix matching)', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true' });
    expect(hostnameInMockProductionAllowlist('evil-licitatiero-staging.vercel.app')).toBe(false);
    expect(hostnameInMockProductionAllowlist('licitatiero-staging.vercel.app.evil.com')).toBe(false);
    expect(paymentsCheckoutMode('evil-licitatiero-staging.vercel.app')).toBe('unavailable');
  });

  it('blocks missing or unparsable APP_URL host', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true', APP_URL: '' });
    expect(paymentsCheckoutMode(STAGING)).toBe('unavailable');
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true', APP_URL: 'not a url' });
    expect(paymentsCheckoutMode(STAGING)).toBe('unavailable');
  });

  it('blocks missing request host when provided empty', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true' });
    expect(paymentsCheckoutMode('')).toBe('unavailable');
  });

  it('blocks prod+flag+staging APP_URL when request host is undefined', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true' });
    expect(paymentsCheckoutMode(undefined)).toBe('unavailable');
    expect(mockPaymentsAllowed(undefined)).toBe(false);
  });

  it('blocks prod+flag+staging APP_URL when request host is null', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true' });
    expect(paymentsCheckoutMode(null)).toBe('unavailable');
    expect(mockPaymentsAllowed(null)).toBe(false);
  });

  it('treats NODE_ENV=production without VERCEL_ENV as production (self-hosted)', () => {
    selfHostedProdEnv({
      PAYMENTS_MOCK_ENABLED: 'true',
      APP_URL: 'https://licitatiero.ro',
    });
    expect(paymentsCheckoutMode('localhost')).toBe('unavailable');
  });

  it('allows self-hosted production mock on localhost when hosts match', () => {
    selfHostedProdEnv({
      PAYMENTS_MOCK_ENABLED: 'true',
      APP_URL: 'http://localhost:3200',
    });
    expect(paymentsCheckoutMode('localhost:3200')).toBe('mock');
  });

  it('keeps VERCEL_ENV=preview non-production for mock flag', () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.PAYMENTS_MOCK_ENABLED = 'true';
    process.env.VERCEL_ENV = 'preview';
    vi.stubEnv('NODE_ENV', 'production');
    expect(paymentsCheckoutMode(undefined)).toBe('mock');
  });

  it('allows dev/preview+flag without allowlist', () => {
    delete process.env.VERCEL_ENV;
    vi.stubEnv('NODE_ENV', 'development');
    process.env.PAYMENTS_MOCK_ENABLED = 'true';
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    expect(paymentsCheckoutMode(undefined)).toBe('mock');
  });

  it('refuses live keys even with flag on allowlisted host', () => {
    stagingProdEnv({ PAYMENTS_MOCK_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_live_deadbeef' });
    expect(paymentsCheckoutMode(STAGING)).toBe('blocked');
  });

  it('prefers stripe test keys over mock on allowlisted staging', () => {
    stagingProdEnv({
      PAYMENTS_MOCK_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_example',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_example',
    });
    expect(paymentsCheckoutMode(STAGING)).toBe('stripe_test');
  });
});

describe('checkout metadata', () => {
  it('extracts promo metadata from checkout.session.completed', () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          metadata: {
            property_id: '10000000-0000-4000-8000-000000000001',
            promo_id: '20000000-0000-4000-8000-000000000002',
            listing_sale_id: '30000000-0000-4000-8000-000000000003',
          },
        },
      },
    } as unknown as Stripe.Event;
    expect(extractCheckoutMetadata(event)?.listingSaleId).toBe('30000000-0000-4000-8000-000000000003');
  });
});
