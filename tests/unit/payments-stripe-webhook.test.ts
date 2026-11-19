import { describe, expect, it } from 'vitest';
import { RequestError } from '@/lib/security';
import {
  completePromoStripeCheckoutRpcParams,
  evaluateCheckoutSessionCompleted,
  stripeEventLivemodeForRpc,
} from '@/lib/payments/stripe-webhook';
import type Stripe from 'stripe';

function completedSession(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Event {
  return {
    id: 'evt_test_checkout',
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        id: 'cs_test_123',
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: 1000,
        currency: 'eur',
        livemode: false,
        metadata: {
          property_id: '10000000-0000-4000-8000-000000000001',
          promo_id: '20000000-0000-4000-8000-000000000002',
        },
        ...overrides,
      } as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}

describe('stripeEventLivemodeForRpc', () => {
  it('passes through Stripe livemode for the database RPC', () => {
    expect(stripeEventLivemodeForRpc({ livemode: false } as Stripe.Event)).toBe(false);
    expect(stripeEventLivemodeForRpc({ livemode: true } as Stripe.Event)).toBe(true);
  });
});

describe('evaluateCheckoutSessionCompleted', () => {
  it('accepts a paid test-mode session for activation', () => {
    const decision = evaluateCheckoutSessionCompleted(completedSession());
    expect(decision).toMatchObject({
      action: 'complete',
      livemode: false,
      metadata: {
        propertyId: '10000000-0000-4000-8000-000000000001',
        promoId: '20000000-0000-4000-8000-000000000002',
        sessionId: 'cs_test_123',
      },
    });
  });

  it('rejects livemode true at the route guard', () => {
    expect(() =>
      evaluateCheckoutSessionCompleted(completedSession({ livemode: true } as Stripe.Checkout.Session)),
    ).toThrow(RequestError);
  });

  it('rejects missing livemode', () => {
    const event = completedSession();
    delete (event as { livemode?: boolean }).livemode;
    expect(() => evaluateCheckoutSessionCompleted(event)).toThrow(RequestError);
  });
});

describe('completePromoStripeCheckoutRpcParams', () => {
  it('passes raw event livemode to complete_promo_stripe_checkout', () => {
    const event = completedSession();
    const decision = evaluateCheckoutSessionCompleted(event);
    if (decision.action !== 'complete') throw new Error('expected complete decision');
    const params = completePromoStripeCheckoutRpcParams(event, decision, 'digest-hex');
    expect(params.p_livemode).toBe(false);
    expect(params.p_livemode).toBe(event.livemode);
    expect(params.p_stripe_event_id).toBe('evt_test_checkout');
    expect(params.p_promo_id).toBe('20000000-0000-4000-8000-000000000002');
  });

  it('would fail activation if livemode were inverted', () => {
    const event = completedSession();
    const decision = evaluateCheckoutSessionCompleted(event);
    if (decision.action !== 'complete') throw new Error('expected complete decision');
    const params = completePromoStripeCheckoutRpcParams(event, decision, 'digest-hex');
    expect(params.p_livemode === false).toBe(event.livemode === false);
    expect(params.p_livemode === true).toBe(false);
  });
});