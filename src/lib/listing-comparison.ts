export type ComparisonQuery = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ids'; ids: string[] } | { kind: 'property'; propertyId: string };
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function parseComparisonQuery(query: { ids?: string | string[]; property?: string | string[] }): ComparisonQuery {
  const ids = Array.isArray(query.ids) ? query.ids : query.ids === undefined ? [] : [query.ids];
  const properties = Array.isArray(query.property) ? query.property : query.property === undefined ? [] : [query.property];
  if (ids.length > 3 || properties.length > 1 || ids.some(value => value.length > 110) || properties.some(value => value.length > 36)) return { kind: 'invalid' };
  const idTokens = ids.flatMap(value => value.split(',')).map(value => value.trim().toLowerCase()).filter(Boolean);
  const property = properties[0]?.trim().toLowerCase();
  if (idTokens.length && property) return { kind: 'invalid' };
  if (property) return uuid.test(property) ? { kind: 'property', propertyId: property } : { kind: 'invalid' };
  if (!idTokens.length) return { kind: 'empty' };
  const unique = [...new Set(idTokens)];
  return unique.length >= 2 && unique.length <= 3 && unique.every(value => uuid.test(value)) ? { kind: 'ids', ids: unique } : { kind: 'invalid' };
}

export interface ComparisonListing {
  id: string; propertyId: string; title: string; transactionType: 'sale' | 'rent'; priceMinor: number;
  areaSqm: number | null; rooms: number | null; propertyType: string; neighborhood: string; judet: string;
  tenancy: 'vacant' | 'occupied' | 'unknown'; auctionMode: 'ascending' | 'sealed' | null;
  auctionState: 'none' | 'invite' | 'scheduled' | 'open' | 'ended' | 'unavailable';
}

/** Only these explicitly public fields cross the server/client boundary. */
export function publicComparisonListing(input: unknown, nowMs: number): ComparisonListing | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  if (row.status !== 'published' || typeof row.id !== 'string' || !uuid.test(row.id) || typeof row.property_id !== 'string' || !uuid.test(row.property_id) ||
      typeof row.title !== 'string' || !row.title.trim() || [...row.title].length > 160 ||
      (row.transaction_type !== 'sale' && row.transaction_type !== 'rent') || row.currency !== 'EUR' ||
      typeof row.price_minor !== 'number' || !Number.isSafeInteger(row.price_minor) || row.price_minor <= 0 || row.price_minor > 1_000_000_000_000) return null;
  const mode = row.auction_mode === 'ascending' || row.auction_mode === 'sealed' ? row.auction_mode : null;
  let state: ComparisonListing['auctionState'] = 'none';
  if (row.auction_id) {
    state = 'unavailable';
    if (row.auction_access === 'invite') state = 'invite';
    else if (row.auction_access === 'public' && mode) {
      const starts = typeof row.starts_at === 'string' ? Date.parse(row.starts_at) : NaN;
      const ends = typeof row.ends_at === 'string' ? Date.parse(row.ends_at) : NaN;
      if (Number.isFinite(nowMs) && Number.isFinite(starts) && Number.isFinite(ends) && ends > starts) state = nowMs >= ends ? 'ended' : nowMs < starts ? 'scheduled' : 'open';
    }
  }
  const text = (value: unknown, max: number) => typeof value === 'string' ? [...value].slice(0, max).join('') : '';
  return {
    id: row.id.toLowerCase(), propertyId: row.property_id.toLowerCase(), title: row.title, transactionType: row.transaction_type, priceMinor: row.price_minor,
    areaSqm: typeof row.area_sqm === 'number' && Number.isFinite(row.area_sqm) && row.area_sqm > 0 ? row.area_sqm : null,
    rooms: typeof row.rooms === 'number' && Number.isInteger(row.rooms) && row.rooms >= 0 && row.rooms <= 100 ? row.rooms : null,
    propertyType: typeof row.property_type === 'string' && ['apartment', 'house', 'studio', 'land', 'commercial'].includes(row.property_type) ? row.property_type : 'unknown',
    neighborhood: text(row.neighborhood, 100), judet: text(row.judet, 40),
    tenancy: row.tenancy_status === 'vacant' || row.tenancy_status === 'occupied' ? row.tenancy_status : 'unknown', auctionMode: mode, auctionState: state,
  };
}

export function selectComparison(options: readonly ComparisonListing[], query: ComparisonQuery): ComparisonListing[] {
  if (query.kind === 'property') return options.filter(item => item.propertyId === query.propertyId).slice(0, 3);
  if (query.kind === 'ids') return query.ids.map(id => options.find(item => item.id === id)).filter((item): item is ComparisonListing => Boolean(item));
  return [];
}
