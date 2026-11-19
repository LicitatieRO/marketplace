import type { DsaElement, DsaReason } from '@/lib/dsa-notices';
import type { Language } from '@/lib/types';
import { translate } from '@/lib/i18n';

export function dsaElementLabel(language: Language, element: DsaElement): string {
  const map: Record<DsaElement, [string, string]> = {
    photos: ['Fotografii', 'Photos'],
    description: ['Descriere', 'Description'],
    price_details: ['Preț și detalii', 'Price & details'],
    virtual_tour: ['Tur virtual', 'Virtual tour'],
    seller_info: ['Informații vânzător', 'Seller info'],
    whole_listing: ['Întregul anunț', 'Whole listing'],
  };
  return translate(language, ...map[element]);
}

export function dsaReasonLabel(language: Language, reason: DsaReason): string {
  const map: Record<DsaReason, [string, string]> = {
    fraud: [
      'Fraudă sau înșelătorie (de ex. proprietate inexistentă, cerere de bani în avans)',
      'Fraud or scam (e.g. non-existent property, advance-payment request)',
    ],
    misleading_info: [
      'Informații false sau înșelătoare despre proprietate (preț, suprafață, situație juridică)',
      'False or misleading property information (price, area, legal status)',
    ],
    ip_infringement: [
      'Încălcarea drepturilor de autor sau de marcă (fotografii, texte copiate)',
      'Copyright or trademark infringement (copied photos or text)',
    ],
    personal_data: ['Date personale publicate fără drept', 'Personal data published unlawfully'],
    hate_threats: [
      'Discriminare, discurs instigator la ură sau amenințări',
      'Discrimination, hate speech or threats',
    ],
    csam: ['Abuz sexual asupra copiilor', 'Child sexual abuse material'],
    other_illegal: ['Alt conținut ilegal', 'Other illegal content'],
    terms_breach: [
      'Încălcarea Termenilor platformei (nu neapărat ilegal)',
      'Breach of platform Terms (not necessarily illegal)',
    ],
  };
  return translate(language, ...map[reason]);
}
