import 'server-only';
import Stripe from 'stripe';
import { RequestError } from '@/lib/security';
import {
  assertStripeKeysNotLive,
  assertStripeTestEvent,
  extractCheckoutMetadata,
  paymentsCheckoutMode,
  paymentsUnavailableResponse,
  stripeLiveModeFlagBlocked,
  stripeTestConfigured,
  validatePaidPromoCheckoutSession,
  type PaymentsCheckoutMode,
} from '@/lib/payments/stripe-guard';

export {
  assertStripeKeysNotLive,
  assertStripeTestEvent,
  extractCheckoutMetadata,
  paymentsCheckoutMode,
  paymentsUnavailableResponse,
  stripeLiveModeFlagBlocked,
  stripeTestConfigured,
  validatePaidPromoCheckoutSession,
  type PaymentsCheckoutMode,
};

export function assertStripeEnvironment(): void {
  assertStripeKeysNotLive();
}

/** @deprecated prefer paymentsCheckoutMode */
export function stripeRuntimeMode(): 'blocked' | 'mock' | 'test' {
  const mode = paymentsCheckoutMode(undefined);
  if (mode === 'blocked') return 'blocked';
  if (mode === 'stripe_test') return 'test';
  if (mode === 'mock') return 'mock';
  return 'blocked';
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getStripeClient(): Stripe | null {
  assertStripeKeysNotLive();
  const secret = readEnv('STRIPE_SECRET_KEY');
  if (!secret?.startsWith('sk_test_')) return null;
  return new Stripe(secret, { typescript: true });
}

export function verifyStripeWebhook(rawBody: string, signature: string | null): Stripe.Event {
  assertStripeKeysNotLive();
  if (!stripeTestConfigured()) {
    throw new RequestError('payments_unavailable', 503);
  }
  const secret = readEnv('STRIPE_WEBHOOK_SECRET');
  if (!secret?.startsWith('whsec_')) {
    throw new RequestError('payments_unavailable', 503);
  }
  if (!signature) throw new RequestError('Missing Stripe-Signature header.', 400);
  const stripe = getStripeClient();
  if (!stripe) throw new RequestError('payments_unavailable', 503);
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    const name = error instanceof Error ? error.name : 'StripeSignatureVerificationError';
    throw new RequestError(name === 'StripeSignatureVerificationError' ? 'Invalid Stripe webhook signature.' : 'Invalid Stripe webhook.', 400);
  }
}