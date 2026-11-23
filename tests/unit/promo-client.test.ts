import { describe, expect, it } from 'vitest';
import {
  isPromoCheckoutErrorCode,
  promoCheckoutUserMessage,
  promoEnvironmentNote,
  promoPanelSimulationOnly,
  promoCheckoutModeFromStatus,
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

  it('exposes coarse status payload without provider details', () => {
    expect(promoStatusPayload('mock')).toEqual({ mode: 'simulated' });
    expect(promoStatusPayload('stripe_test')).toEqual({ mode: 'test' });
    expect(promoStatusPayload('unavailable')).toEqual({ mode: 'unavailable' });
    expect(promoStatusPayload('blocked')).toEqual({ mode: 'unavailable' });
    expect(JSON.stringify(promoStatusPayload('mock'))).not.toMatch(/sk_|whsec|PAYMENTS|stripe_test|mock/);
  });

  it('maps public status back to checkout mode for the workspace UI', () => {
    expect(promoCheckoutModeFromStatus('test')).toBe('stripe_test');
    expect(promoCheckoutModeFromStatus('simulated')).toBe('mock');
    expect(promoCheckoutModeFromStatus('unavailable')).toBe('unavailable');
  });
});
