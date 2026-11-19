import { afterEach, describe, expect, it } from 'vitest';
import { assertStripeTestEvent, validatePaidPromoCheckoutSession } from '@/lib/payments/stripe-guard';
import { RequestError } from '@/lib/security';
import type Stripe from 'stripe';

const env = { ...process.env };

afterEach(() => {
  process.env = { ...env };
});

describe('assertStripeTestEvent', () => {
  it('rejects livemode true', () => {
    const event = { livemode: true, data: { object: { livemode: true } } } as Stripe.Event;
    expect(() => assertStripeTestEvent(event)).toThrow(RequestError);
  });

  it('rejects missing livemode', () => {
    const event = { data: { object: {} } } as Stripe.Event;
    expect(() => assertStripeTestEvent(event)).toThrow(RequestError);
  });

  it('accepts test-mode events', () => {
    const event = { livemode: false, data: { object: { livemode: false } } } as Stripe.Event;
    expect(() => assertStripeTestEvent(event)).not.toThrow();
  });
});

describe('validatePaidPromoCheckoutSession', () => {
  it('requires paid status and €10 eur', () => {
    const session = {
      payment_status: 'unpaid',
      amount_total: 1000,
      currency: 'eur',
      metadata: { property_id: 'a', promo_id: 'b' },
    } as unknown as Stripe.Checkout.Session;
    expect(validatePaidPromoCheckoutSession(session)).toBe('payment_status');
    session.payment_status = 'paid';
    expect(validatePaidPromoCheckoutSession(session)).toBeNull();
  });
});