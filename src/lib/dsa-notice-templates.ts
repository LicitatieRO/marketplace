import type { DsaDecision, DsaGroundType } from '@/lib/dsa-notices';
import type { Language } from '@/lib/types';
import { translate } from '@/lib/i18n';

export function dsaDecisionLabel(language: Language, decision: DsaDecision): string {
  const labels: Record<DsaDecision, [string, string]> = {
    no_action: ['Fără acțiune', 'No action'],
    content_removed: ['Conținut eliminat', 'Content removed'],
    access_disabled: ['Acces restricționat', 'Access disabled'],
    listing_suspended: ['Anunț suspendat', 'Listing suspended'],
    account_suspended: ['Cont suspendat', 'Account suspended'],
  };
  const [ro, en] = labels[decision];
  return translate(language, ro, en);
}

export function renderNotifierDecisionEmail(params: {
  language: Language;
  id: string;
  decision: DsaDecision;
  shortReason: string;
}): { ro: string; en: string } {
  const decisionRo = dsaDecisionLabel('ro', params.decision);
  const decisionEn = dsaDecisionLabel('en', params.decision);
  return {
    ro: `Am analizat notificarea ta (nr. ${params.id}). Decizie: ${decisionRo}. Motiv: ${params.shortReason}. Dacă nu ești de acord, ne poți răspunde la acest e-mail pentru o reanalizare; ai, de asemenea, dreptul de a te adresa instanței competente.`,
    en: `We reviewed your notice (ref. ${params.id}). Decision: ${decisionEn}. Reason: ${params.shortReason}. If you disagree, reply to this email to ask for a re-review; you also have the right to go to the competent court.`,
  };
}

export function renderOwnerStatementOfReasons(params: {
  listingUrl: string;
  decision: DsaDecision;
  dateIso: string;
  endDateIso?: string | null;
  facts: string;
  groundType: DsaGroundType;
  ground: string;
  automated: boolean;
  followedNotice: boolean;
}): { ro: string; en: string } {
  const decisionRo = dsaDecisionLabel('ro', params.decision);
  const decisionEn = dsaDecisionLabel('en', params.decision);
  const dateRo = formatStatementDate(params.dateIso, 'ro');
  const dateEn = formatStatementDate(params.dateIso, 'en');
  const endRo = params.endDateIso ? formatStatementDate(params.endDateIso, 'ro') : null;
  const endEn = params.endDateIso ? formatStatementDate(params.endDateIso, 'en') : null;
  const groundRo =
    params.groundType === 'legal' ? params.ground : `clauza ${params.ground} din Termeni`;
  const groundEn =
    params.groundType === 'legal' ? params.ground : `clause ${params.ground} of the Terms`;
  const autoRo = params.automated ? 'a fost' : 'nu a fost';
  const autoEn = params.automated ? 'were' : 'were not';
  const sourceRo = params.followedNotice ? 'unei notificări' : 'verificării noastre';
  const sourceEn = params.followedNotice ? 'a notice' : 'our own review';
  const endSuffixRo = endRo ? `, până la ${endRo}` : '';
  const endSuffixEn = endEn ? ` until ${endEn}` : '';
  return {
    ro: `Am luat următoarea măsură privind anunțul tău ${params.listingUrl}: ${decisionRo}, începând cu ${dateRo}${endSuffixRo}. Faptele avute în vedere: ${params.facts}. Temei: ${groundRo}. Măsura ${autoRo} luată prin mijloace automate. Decizia a fost luată în urma ${sourceRo}. Poți contesta decizia răspunzând la acest e-mail; ai, de asemenea, dreptul la soluționarea extrajudiciară a litigiului și la acțiune în instanță.`,
    en: `We have taken the following action on your listing ${params.listingUrl}: ${decisionEn}, from ${dateEn}${endSuffixEn}. Facts relied on: ${params.facts}. Ground: ${groundEn}. Automated means ${autoEn} used. The decision followed ${sourceEn}. You may contest it by replying to this email; you also have the right to out-of-court dispute settlement and to go to court.`,
  };
}

function formatStatementDate(iso: string, language: Language): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(language === 'ro' ? 'ro-RO' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function pickBilingualBody(bodies: { ro: string; en: string }, language: Language): string {
  return translate(language, bodies.ro, bodies.en);
}
