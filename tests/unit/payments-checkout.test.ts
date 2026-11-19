import { describe, expect, it } from 'vitest';
import { PROMO_CHECKOUT_SESSION_MINUTES, promoCheckoutExpiresAtUnix } from '@/lib/payments/constants';

describe('promoCheckoutExpiresAtUnix', () => {
  it('sets Checkout expiry to now plus 31 minutes', () => {
    const now = 1_700_000_000_000;
    expect(promoCheckoutExpiresAtUnix(now)).toBe(
      Math.floor(now / 1000) + PROMO_CHECKOUT_SESSION_MINUTES * 60,
    );
  });
});