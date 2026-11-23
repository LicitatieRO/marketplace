import { promoStatusPayload } from '@/lib/payments/promo-client';
import { paymentsCheckoutMode } from '@/lib/payments/stripe-guard';
import { json } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const mode = paymentsCheckoutMode(request.headers.get('host') ?? '');
  return json({ data: promoStatusPayload(mode) });
}