import { assertSameOrigin, requestOrigin } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { createPromoCheckoutSession } from '@/lib/payments/checkout';
import { listingIdsForProperty, loadWorkspaceForOwner } from '@/lib/payments/property-owner';
import { databaseFailure, failure, json, readJson } from '@/lib/server/http';
import { paymentsServiceClient } from '@/lib/server/payments-db';
import { getStripeClient } from '@/lib/server/stripe';
import {
  assertStripeKeysNotLive,
  paymentsCheckoutMode,
  paymentsUnavailableResponse,
} from '@/lib/payments/stripe-guard';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    property_id: z.uuid(),
    idempotency_key: z.uuid(),
    accept_terms: z.literal(true),
  })
  .strict();

export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers, requestOrigin(request.url));
    const input = bodySchema.parse(await readJson(request));
    assertStripeKeysNotLive();
    const checkoutMode = paymentsCheckoutMode(request.headers.get('host') ?? '');
    if (checkoutMode === 'blocked') {
      return json(
        {
          error:
            'In this POC, promotion and payment flows are available only in Stripe Test Mode. The current environment is not a test environment. The operation was blocked; no payment was taken.',
        },
        503,
      );
    }
    if (checkoutMode === 'unavailable') {
      return json(paymentsUnavailableResponse(), 503);
    }
    const { db, user } = await requireUser();
    const workspace = await loadWorkspaceForOwner(db, user.id, input.property_id);
    const listingIds = listingIdsForProperty(workspace.listings, input.property_id);
    const service = paymentsServiceClient();
    const promoMode = checkoutMode === 'stripe_test' ? 'stripe_test' : 'mock';
    const prepare = await service.rpc('prepare_property_promo', {
      p_property_id: input.property_id,
      p_owner_id: user.id,
      p_idempotency_key: input.idempotency_key,
      p_mode: promoMode,
    });
    if (prepare.error) return databaseFailure(prepare.error);
    const prepared = prepare.data as {
      id: string;
      reused?: boolean;
      stripe_session_id?: string | null;
    };
    const promoId = String(prepared.id);
    if (promoMode === 'mock') {
      const complete = await service.rpc('complete_mock_property_promo', {
        p_promo_id: promoId,
        p_owner_id: user.id,
        p_idempotency_key: input.idempotency_key,
      });
      if (complete.error) return databaseFailure(complete.error);
      return json({
        data: {
          mode: 'mock',
          poc: true,
          testMode: true,
          real_amount_minor: 0,
          receipt: complete.data,
          message: 'Simulation completed (POC / Simulare). No real charge.',
        },
      });
    }
    if (prepared.reused && prepared.stripe_session_id) {
      const stripe = getStripeClient();
      const existing = stripe ? await stripe.checkout.sessions.retrieve(prepared.stripe_session_id) : null;
      if (existing?.url) {
        return json({
          data: {
            mode: 'stripe_test',
            poc: true,
            testMode: true,
            checkout_url: existing.url,
            session_id: existing.id,
            promo_id: promoId,
            reused: true,
            displayed_amount_minor: 1000,
            real_amount_minor: 0,
          },
        });
      }
    }
    const session = await createPromoCheckoutSession({
      requestHost: request.headers.get('host') ?? '',
      origin: requestOrigin(request.url),
      propertyId: input.property_id,
      promoId,
      listingSaleId: listingIds.saleId,
      listingRentId: listingIds.rentId,
    });
    if (!session) return json(paymentsUnavailableResponse(), 503);
    const attach = await service.rpc('attach_promo_checkout_session', {
      p_promo_id: promoId,
      p_owner_id: user.id,
      p_stripe_session_id: session.sessionId,
    });
    if (attach.error) return databaseFailure(attach.error);
    return json({
      data: {
        mode: 'stripe_test',
        poc: true,
        testMode: true,
        checkout_url: session.url,
        session_id: session.sessionId,
        promo_id: promoId,
        reused: prepared.reused === true,
        displayed_amount_minor: 1000,
        real_amount_minor: 0,
      },
    });
  } catch (error) {
    return failure(error);
  }
}