import type Stripe from 'stripe';
import { RequestError } from '@/lib/security';
import { PROMO_AMOUNT_MINOR } from '@/lib/payments/constants';
import { isProductionRuntime, stagingHostsAllowlistedForRequest } from '@/lib/server/staging-host';

export type PaymentsCheckoutMode = 'blocked' | 'unavailable' | 'stripe_test' | 'mock';

/** Stable public surface for payments + notifications; implementations live in staging-host. */
export {
  STAGING_HOST_ALLOWLIST as PAYMENTS_MOCK_PRODUCTION_HOST_ALLOWLIST,
  configuredAppHostname,
  hostnameInStagingAllowlist as hostnameInMockProductionAllowlist,
  isProductionRuntime as isProductionPaymentsHost,
  normalizeHostname,
  requestHostProvided,
  stagingOutboxProductionHostAllowed,
  stagingOutboxProductionHostAllowedForConfiguredApp,
} from '@/lib/server/staging-host';

const LIVE_PREFIXES = ['pk_live_', 'sk_live_'] as const;
const TEST_SECRET_PREFIX = 'sk_test_';
const TEST_WEBHOOK_PREFIX = 'whsec_';

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function stripeLiveModeFlagBlocked(): boolean {
  const mode = (process.env.STRIPE_MODE || process.env.STRIPE_LIVEMODE || '').toLowerCase();
  return mode === 'live' || mode === 'true' || process.env.STRIPE_LIVEMODE === '1';
}

function rejectLiveKey(value: string | undefined): void {
  if (!value) return;
  if (LIVE_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    throw new RequestError(
      'In this POC, promotion and payment flows are available only in Stripe Test Mode. The current environment is not a test environment. The operation was blocked; no payment was taken.',
      503,
    );
  }
}

export function assertStripeKeysNotLive(): void {
  if (stripeLiveModeFlagBlocked()) {
    throw new RequestError(
      'In this POC, promotion and payment flows are available only in Stripe Test Mode. The current environment is not a test environment. The operation was blocked; no payment was taken.',
      503,
    );
  }
  rejectLiveKey(readEnv('STRIPE_SECRET_KEY'));
  rejectLiveKey(readEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'));
  rejectLiveKey(readEnv('STRIPE_PUBLISHABLE_KEY'));
  rejectLiveKey(readEnv('STRIPE_WEBHOOK_SECRET'));
}

/** @deprecated use assertStripeKeysNotLive */
export function assertStripeEnvironment(): void {
  assertStripeKeysNotLive();
}

export function mockPaymentsAllowed(requestHost: string | null | undefined): boolean {
  if (readEnv('PAYMENTS_MOCK_ENABLED') !== 'true') return false;
  if (!isProductionRuntime()) return true;
  return stagingHostsAllowlistedForRequest(requestHost);
}

export function stripeTestConfigured(): boolean {
  const secret = readEnv('STRIPE_SECRET_KEY');
  const webhook = readEnv('STRIPE_WEBHOOK_SECRET');
  return Boolean(secret?.startsWith(TEST_SECRET_PREFIX) && webhook?.startsWith(TEST_WEBHOOK_PREFIX));
}

export function paymentsCheckoutMode(requestHost: string | null | undefined): PaymentsCheckoutMode {
  try {
    assertStripeKeysNotLive();
  } catch {
    return 'blocked';
  }
  if (stripeTestConfigured()) return 'stripe_test';
  if (mockPaymentsAllowed(requestHost)) return 'mock';
  return 'unavailable';
}

/** @deprecated use paymentsCheckoutMode */
export function stripeRuntimeMode(): 'blocked' | 'mock' | 'test' {
  const mode = paymentsCheckoutMode(undefined);
  if (mode === 'blocked') return 'blocked';
  if (mode === 'stripe_test') return 'test';
  if (mode === 'mock') return 'mock';
  return 'blocked';
}

export function paymentsUnavailableResponse(): { error: 'payments_unavailable' } {
  return { error: 'payments_unavailable' };
}

export function paymentsBlockedResponse(): { error: 'payments_blocked' } {
  return { error: 'payments_blocked' };
}

export function assertStripeTestEvent(event: Stripe.Event): void {
  if (event.livemode !== false) {
    throw new RequestError('Live mode events are not processed in this POC.', 400);
  }
  const session = event.data?.object as Stripe.Checkout.Session | undefined;
  if (session && session.livemode !== false) {
    throw new RequestError('Live mode events are not processed in this POC.', 400);
  }
}

export function validatePaidPromoCheckoutSession(session: Stripe.Checkout.Session): string | null {
  if (session.payment_status !== 'paid') return 'payment_status';
  if (session.amount_total !== PROMO_AMOUNT_MINOR) return 'amount_total';
  if ((session.currency || '').toLowerCase() !== 'eur') return 'currency';
  if (!session.metadata?.property_id || !session.metadata?.promo_id) return 'metadata';
  return null;
}

export function extractCheckoutMetadata(event: Stripe.Event): {
  propertyId: string;
  promoId: string;
  sessionId: string;
  listingSaleId: string | null;
  listingRentId: string | null;
} | null {
  if (event.type !== 'checkout.session.completed') return null;
  const session = event.data.object as Stripe.Checkout.Session;
  const propertyId = session.metadata?.property_id;
  const promoId = session.metadata?.promo_id;
  if (!propertyId || !promoId || !session.id) return null;
  return {
    propertyId,
    promoId,
    sessionId: session.id,
    listingSaleId: session.metadata?.listing_sale_id ?? null,
    listingRentId: session.metadata?.listing_rent_id ?? null,
  };
}
