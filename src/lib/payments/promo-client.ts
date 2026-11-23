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
  return t(
    'Nu am putut porni promovarea (POC / Simulare). Încercați din nou.',
    'We could not start promotion (POC / Simulation). Try again.',
  );
}

export const promoRankingDisclosurePath = '/legal/terms#how-we-rank-listings';

export const promoPanelEyebrow = 'TEST MODE / MOD TEST · POC / Simulare';

export function promoPanelTitle(t: Translate): string {
  return t(
    'Promovare 7 zile — previzualizare în mod test (POC / Simulare)',
    '7-day promotion — test-mode preview (POC / Simulation)',
  );
}

export function promoPanelEffectBeforeLink(t: Translate): string {
  return t(
    'Pe durata celor 7 zile, anunțul (și, dacă există, anunțul pereche de vânzare sau închiriere al aceleiași proprietăți) este marcat cu eticheta „Promovat”. Efectul asupra ordinii în catalog este descris la ',
    'For 7 days, the listing (and, if there is one, the linked sale or rent listing of the same property) is labelled “Promoted”. The effect on catalogue order is described under ',
  );
}

export function promoPanelEffectAfterLink(t: Translate): string {
  return t(
    ' În acest POC nu se încasează nicio sumă reală.',
    ' This POC does not collect any real payment.',
  );
}

export function promoPanelRankingLinkLabel(t: Translate): string {
  return t('Cum ordonăm anunțurile', 'How we rank listings');
}

export function promoPanelFacts(t: Translate): string[] {
  return [
    t(
      'Preț total afișat: 10,00 EUR / 7 zile, TVA inclus.',
      'Total displayed price: €10.00 / 7 days, including VAT.',
    ),
    t(
      'Sumă reală încasată în acest POC: 0,00 EUR.',
      'Real amount charged in this POC: €0.00.',
    ),
    t(
      'Mediu: Stripe Test Mode sau simulare internă — doar carduri de test, livemode=false. Nu este o factură fiscală și nu naște o obligație de plată.',
      'Environment: Stripe Test Mode or internal simulation — test cards only, livemode=false. This is not a tax invoice and creates no payment obligation.',
    ),
  ];
}

export function promoPanelCheckbox(t: Translate): string {
  return t(
    'Înțeleg că aceasta este o simulare POC în mod test, că prețul afișat de 10,00 EUR (TVA inclus) nu va fi încasat, că folosesc doar un card de test și că nu se naște nicio obligație de plată.',
    'I understand this is a POC test-mode simulation, that the displayed price of €10.00 (including VAT) will not be charged, that I will use a test card only, and that this creates no payment obligation.',
  );
}

export function promoPanelPrimaryButton(t: Translate): string {
  return t(
    'Simulează promovarea în mod test — Nu se percepe nicio taxă reală',
    'Simulate promotion in test mode — No real charge',
  );
}

export function promoPanelWithdrawal(t: Translate): string {
  return t(
    'Dreptul de retragere (mod test / POC): în această versiune nu se încheie un contract de plată și nu se încasează nicio sumă reală, deci nu există o plată de rambursat. Acest text este un loc rezervat. Când va fi activată facturarea reală către consumatori, se vor aplica regulile din OUG nr. 34/2014 privind contractele la distanță pentru servicii digitale, iar textul definitiv va fi publicat înainte de prima încasare.',
    'Right of withdrawal (test mode / POC): in this version no payment contract is formed and no real amount is charged, so there is no payment to refund. This is placeholder wording. When live billing to consumers is turned on, the distance-contract rules in OUG no. 34/2014 for digital services will apply, and the final wording will be published before the first real charge.',
  );
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

export type PromoStatusMode = 'simulated' | 'test' | 'unavailable';

export function promoStatusPayload(mode: PromoCheckoutMode): { mode: PromoStatusMode } {
  if (mode === 'stripe_test') return { mode: 'test' };
  if (mode === 'mock') return { mode: 'simulated' };
  return { mode: 'unavailable' };
}

export function promoCheckoutModeFromStatus(status: PromoStatusMode): PromoCheckoutMode {
  if (status === 'test') return 'stripe_test';
  if (status === 'simulated') return 'mock';
  return 'unavailable';
}
