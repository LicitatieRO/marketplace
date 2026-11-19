import 'server-only';
import type Stripe from 'stripe';
import { PROMO_AMOUNT_MINOR, PROMO_CURRENCY, promoCheckoutExpiresAtUnix } from '@/lib/payments/constants';
import { getStripeClient, paymentsCheckoutMode } from '@/lib/server/stripe';

export function checkoutProductName(): string {
  return 'POC / Simulare — Listing promotion (7 days / test mode)';
}

export async function createPromoCheckoutSession(input: {
  requestHost: string | null | undefined;
  origin: string;
  propertyId: string;
  promoId: string;
  listingSaleId?: string | null;
  listingRentId?: string | null;
}): Promise<{ url: string; sessionId: string } | null> {
  if (paymentsCheckoutMode(input.requestHost) !== 'stripe_test') return null;
  const stripe = getStripeClient();
  if (!stripe) return null;
  const success = new URL('/workspace', input.origin);
  success.searchParams.set('tab', 'owner');
  success.searchParams.set('promo', 'test-complete');
  const cancel = new URL('/workspace', input.origin);
  cancel.searchParams.set('tab', 'owner');
  cancel.searchParams.set('promo', 'cancelled');
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      allowed_payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: PROMO_CURRENCY.toLowerCase(),
            unit_amount: PROMO_AMOUNT_MINOR,
            product_data: { name: checkoutProductName() },
          },
        },
      ],
      success_url: success.toString(),
      cancel_url: cancel.toString(),
      expires_at: promoCheckoutExpiresAtUnix(),
      metadata: {
        property_id: input.propertyId,
        promo_id: input.promoId,
        purpose: 'poc_promotion',
        ...(input.listingSaleId ? { listing_sale_id: input.listingSaleId } : {}),
        ...(input.listingRentId ? { listing_rent_id: input.listingRentId } : {}),
      },
    },
    { idempotencyKey: input.promoId },
  );
  if (session.livemode !== false) {
    throw new Error('Stripe returned a livemode checkout session; blocked.');
  }
  if (!session.url) throw new Error('Stripe checkout URL missing.');
  return { url: session.url, sessionId: session.id };
}

export function digestStripeEvent(event: Stripe.Event): string {
  return `${event.id}:${event.type}:${event.livemode === false ? 'test' : 'live'}`;
}