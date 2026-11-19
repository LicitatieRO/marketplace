import type Stripe from 'stripe';
import { assertStripeTestEvent, extractCheckoutMetadata, validatePaidPromoCheckoutSession } from '@/lib/payments/stripe-guard';

export type PromoCheckoutWebhookDecision =
  | { action: 'reject'; reason: string }
  | {
      action: 'complete';
      metadata: NonNullable<ReturnType<typeof extractCheckoutMetadata>>;
      livemode: boolean;
    };

export function stripeEventLivemodeForRpc(event: Stripe.Event): boolean {
  return event.livemode;
}

export function evaluateCheckoutSessionCompleted(event: Stripe.Event): PromoCheckoutWebhookDecision {
  assertStripeTestEvent(event);
  if (event.type !== 'checkout.session.completed') {
    return { action: 'reject', reason: 'event_type' };
  }
  const session = event.data.object as Stripe.Checkout.Session;
  const validationError = validatePaidPromoCheckoutSession(session);
  if (validationError) {
    return { action: 'reject', reason: validationError };
  }
  const metadata = extractCheckoutMetadata(event);
  if (!metadata) {
    return { action: 'reject', reason: 'metadata' };
  }
  return { action: 'complete', metadata, livemode: stripeEventLivemodeForRpc(event) };
}

export function completePromoStripeCheckoutRpcParams(
  event: Stripe.Event,
  decision: Extract<PromoCheckoutWebhookDecision, { action: 'complete' }>,
  payloadDigestHex: string,
) {
  return {
    p_stripe_event_id: event.id,
    p_event_type: event.type,
    p_livemode: decision.livemode,
    p_payload_digest: payloadDigestHex,
    p_session_id: decision.metadata.sessionId,
    p_property_id: decision.metadata.propertyId,
    p_promo_id: decision.metadata.promoId,
  };
}