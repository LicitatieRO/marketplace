export type PromoCheckoutMode = 'blocked' | 'unavailable' | 'stripe_test' | 'mock';

export const PROMO_CHECKOUT_ERROR_CODES = [
  'payments_unavailable',
  'payments_blocked',
] as const;

export type PromoCheckoutErrorCode = (typeof PROMO_CHECKOUT_ERROR_CODES)[number];

export function isPromoCheckoutErrorCode(value: unknown): value is PromoCheckoutErrorCode {
  return (
    value === 'payments_unavailable' ||
    value === 'payments_blocked'
  );
}

type Translate = (ro: string, en: string) => string;

export function promoCheckoutUserMessage(code: string | undefined, t: Translate): string {
  if (code === 'payments_unavailable') {
    return t(
      'Promovarea este simulată în acest mediu; plățile nu sunt configurate.',
      'Promotion is simulated in this environment; payments are not configured.',
    );
  }
  if (code === 'payments_blocked') {
    return t(
      'Promovarea este disponibilă doar în mod test (POC / Simulare).',
      'Promotion is available in test mode only (POC / Simulation).',
    );
  }
  return t('Nu am putut porni promovarea. Încercați din nou.', 'We could not start promotion. Try again.');
}

export function promoEnvironmentNote(mode: PromoCheckoutMode, t: Translate): string {
  if (mode === 'stripe_test') {
    return t(
      'POC / Simulare — promovarea folosește Stripe în mod test; nu se percepe nicio taxă reală.',
      'POC / Simulation — promotion uses Stripe test mode; no real charge is taken.',
    );
  }
  if (mode === 'mock') {
    return t(
      'POC / Simulare — promovarea este simulată local; nu se percepe nicio taxă reală.',
      'POC / Simulation — promotion is simulated locally; no real charge is taken.',
    );
  }
  return t(
    'POC / Simulare — promovarea este doar demonstrativă; plățile nu sunt active în acest mediu.',
    'POC / Simulation — promotion is for demonstration only; payments are not active in this environment.',
  );
}

export function promoPanelSimulationOnly(mode: PromoCheckoutMode): boolean {
  return mode === 'blocked' || mode === 'unavailable';
}

export function promoStatusPayload(mode: PromoCheckoutMode) {
  return {
    mode,
    poc: true,
    testMode: true,
  } as const;
}