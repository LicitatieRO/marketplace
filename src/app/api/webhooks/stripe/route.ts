import { createHash } from 'node:crypto';
import { digestStripeEvent } from '@/lib/payments/checkout';
import { paymentsServiceClient } from '@/lib/server/payments-db';
import { databaseFailure, failure, json } from '@/lib/server/http';
import {
  completePromoStripeCheckoutRpcParams,
  evaluateCheckoutSessionCompleted,
} from '@/lib/payments/stripe-webhook';
import {
  assertStripeKeysNotLive,
  paymentsCheckoutMode,
  paymentsUnavailableResponse,
  verifyStripeWebhook,
} from '@/lib/server/stripe';
import { RequestError } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    assertStripeKeysNotLive();
    if (paymentsCheckoutMode(request.headers.get('host') ?? '') !== 'stripe_test') {
      return json(paymentsUnavailableResponse(), 503);
    }
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');
    const event = verifyStripeWebhook(rawBody, signature);
    if (event.type !== 'checkout.session.completed') {
      return json({ received: true, skipped: event.type, poc: true, testMode: true });
    }
    const decision = evaluateCheckoutSessionCompleted(event);
    if (decision.action === 'reject') {
      console.error('Stripe webhook rejected checkout', { id: event.id, type: event.type, reason: decision.reason });
      return json({ status: 'rejected', reason: decision.reason, poc: true, testMode: true });
    }
    const db = paymentsServiceClient();
    const digest = createHash('sha256').update(digestStripeEvent(event)).digest('hex');
    const { data, error } = await db.rpc(
      'complete_promo_stripe_checkout',
      completePromoStripeCheckoutRpcParams(event, decision, digest),
    );
    if (error) return databaseFailure(error);
    const result = data as { status?: string };
    if (result?.status === 'duplicate' || result?.status === 'rejected_mismatch' || result?.status === 'rejected_livemode') {
      return json({ data, poc: true, testMode: true });
    }
    return json({ data, poc: true, testMode: true });
  } catch (error) {
    if (error instanceof RequestError) return failure(error);
    console.error('Stripe webhook failed');
    return json({ error: 'Webhook processing failed.' }, 500);
  }
}