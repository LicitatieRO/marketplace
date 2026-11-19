export const PROMO_AMOUNT_MINOR = 1000;
export const PROMO_DURATION_DAYS = 7;
export const PROMO_CURRENCY = 'EUR';
export const POC_PAYMENT_LABEL = 'POC / Simulare';
/** Stripe Checkout minimum is 30 minutes; add buffer for request latency. */
export const PROMO_CHECKOUT_SESSION_MINUTES = 31;
/** DB pending hold outlives the Checkout session so abandonment sweep beats late pay mismatch. */
export const PROMO_PENDING_HOLD_MINUTES = 35;

export function promoCheckoutExpiresAtUnix(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000) + PROMO_CHECKOUT_SESSION_MINUTES * 60;
}