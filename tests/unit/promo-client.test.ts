import { describe, expect, it } from 'vitest';
import {
  isPromoCheckoutErrorCode,
  promoCheckoutUserMessage,
  promoEnvironmentNote,
  promoPanelSimulationOnly,
  promoStatusPayload,
} from '@/lib/payments/promo-client';

const t = (ro: string, en: string) => (ro || en);

describe('promo client copy', () => {
  it('maps checkout error codes to localized messages', () => {
    expect(promoCheckoutUserMessage('payments_unavailable', t)).toMatch(/simulată/);
    expect(promoCheckoutUserMessage('payments_blocked', t)).toMatch(/mod test/);
    expect(promoCheckoutUserMessage('stripe_error_raw', t)).toMatch(/promovarea/);
  });

  it('recognizes stable checkout error codes', () => {
    expect(isPromoCheckoutErrorCode('payments_unavailable')).toBe(true);
    expect(isPromoCheckoutErrorCode('payments_blocked')).toBe(true);
    expect(isPromoCheckoutErrorCode('In this POC, promotion')).toBe(false);
  });

  it('treats blocked and unavailable as simulation-only UI', () => {
    expect(promoPanelSimulationOnly('blocked')).toBe(true);
    expect(promoPanelSimulationOnly('unavailable')).toBe(true);
    expect(promoPanelSimulationOnly('mock')).toBe(false);
    expect(promoPanelSimulationOnly('stripe_test')).toBe(false);
  });

  it('builds one workspace environment note per mode', () => {
    expect(promoEnvironmentNote('mock', t)).toMatch(/simulată local/);
    expect(promoEnvironmentNote('stripe_test', t)).toMatch(/Stripe/);
    expect(promoEnvironmentNote('unavailable', t)).toMatch(/demonstrativă/);
  });

  it('exposes status payload without provider details', () => {
    expect(promoStatusPayload('unavailable')).toEqual({
      mode: 'unavailable',
      poc: true,
      testMode: true,
    });
  });
});