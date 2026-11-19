export interface SealedOffer {
  id: string;
  bidder_display_name: string;
  amount_minor: number;
  created_at: string;
}
export type SealedOfferSort = 'amountAsc' | 'amountDesc' | 'timeAsc' | 'timeDesc';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Fail on missing amounts; never turn a denied or malformed row into a zero offer. */
export function parseSealedOffers(data: unknown): SealedOffer[] {
  if (!Array.isArray(data)) throw new Error('Invalid confidential offers response.');
  return data.map((row) => {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !uuid.test(row.id) ||
        typeof row.bidder_display_name !== 'string' || [...row.bidder_display_name].length > 100 ||
        !Number.isSafeInteger(row.amount_minor) || row.amount_minor <= 0 || row.amount_minor > 1_000_000_000_000 ||
        typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at))) {
      throw new Error('Invalid confidential offers response.');
    }
    return { id: row.id, bidder_display_name: row.bidder_display_name, amount_minor: row.amount_minor, created_at: row.created_at };
  });
}

export function sortSealedOffers(rows: readonly SealedOffer[], order: SealedOfferSort): SealedOffer[] {
  return [...rows].sort((a, b) => {
    const byAmount = a.amount_minor - b.amount_minor;
    const byTime = Date.parse(a.created_at) - Date.parse(b.created_at);
    const result = order === 'amountAsc' ? byAmount : order === 'amountDesc' ? -byAmount : order === 'timeAsc' ? byTime : -byTime;
    return result || a.id.localeCompare(b.id);
  });
}
