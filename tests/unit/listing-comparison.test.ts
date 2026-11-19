import { describe, expect, it } from 'vitest';
import { parseComparisonQuery, publicComparisonListing, selectComparison } from '@/lib/listing-comparison';
const property = '10000000-0000-4000-8000-000000000001';
const sale = '20000000-0000-4000-8000-000000000001', rent = '30000000-0000-4000-8000-000000000001';
const now = Date.parse('2026-11-16T07:00:00Z');
const raw = { id: sale, property_id: property, title: 'Public home', status: 'published', transaction_type: 'sale', price_minor: 10000000, currency: 'EUR', area_sqm: 60, rooms: 2, property_type: 'apartment', neighborhood: 'Cotroceni', judet: 'București', tenancy_status: 'vacant', auction_id: 'auction', auction_mode: 'sealed', auction_access: 'public', starts_at: '2026-11-16T06:00:00Z', ends_at: '2026-11-16T08:00:00Z' };

describe('bounded comparison queries', () => {
  it('accepts comma-separated or repeated IDs and one property selector', () => {
    expect(parseComparisonQuery({ ids: `${sale},${rent}` })).toEqual({ kind: 'ids', ids: [sale, rent] });
    expect(parseComparisonQuery({ ids: [sale, rent, ''] })).toEqual({ kind: 'ids', ids: [sale, rent] });
    expect(parseComparisonQuery({ property })).toEqual({ kind: 'property', propertyId: property });
    expect(parseComparisonQuery({})).toEqual({ kind: 'empty' });
  });
  it.each([{ ids: sale }, { ids: `${sale},${sale}` }, { ids: 'bad,id' }, { ids: `${sale},${rent}`, property }, { property: 'bad' }, { ids: 'a'.repeat(1000) }])('rejects invalid, ambiguous or oversized selections', (query) => {
    expect(parseComparisonQuery(query).kind).toBe('invalid');
  });
});
describe('public comparison DTO boundary', () => {
  it('drops private/unused fields even when the source viewer is an owner', () => {
    const result = publicComparisonListing({ ...raw, owner_id: 'private-owner', exact_address: 'Private address marker', current_bid_minor: 987654321, bids: [{ amount: 999 }], description: 'Unused description', tour_url: 'private-tour' }, now)!;
    const serialized = JSON.stringify(result);
    expect(result.auctionState).toBe('open');
    for (const forbidden of ['owner_id', 'private-owner', 'Private address marker', '987654321', 'bids', 'description', 'tour_url', 'starts_at', 'ends_at']) expect(serialized).not.toContain(forbidden);
  });
  it('never discloses invitation-only timing even if source owner can read it', () => {
    expect(publicComparisonListing({ ...raw, auction_access: 'invite' }, now)?.auctionState).toBe('invite');
  });
  it.each([{ status: 'closed' }, { price_minor: 0 }, { price_minor: NaN }, { currency: 'RON' }, { id: 'bad' }])('refuses invalid/unpublished records instead of inventing prices', (change) => {
    expect(publicComparisonListing({ ...raw, ...change }, now)).toBeNull();
  });
  it('classifies a server snapshot, treating closing equality as ended', () => {
    expect(publicComparisonListing(raw, Date.parse(raw.ends_at))?.auctionState).toBe('ended');
    expect(publicComparisonListing(raw, Date.parse(raw.starts_at) - 1)?.auctionState).toBe('scheduled');
    expect(publicComparisonListing({ ...raw, auction_id: null }, now)?.auctionState).toBe('none');
    expect(publicComparisonListing({ ...raw, ends_at: null }, now)?.auctionState).toBe('unavailable');
  });
});
it('selects linked sale/rent and preserves explicit listing order', () => {
  const a = publicComparisonListing(raw, now)!;
  const b = publicComparisonListing({ ...raw, id: rent, transaction_type: 'rent', price_minor: 75000 }, now)!;
  expect(selectComparison([a, b], { kind: 'property', propertyId: property }).map(x => x.id)).toEqual([a.id, b.id]);
  expect(selectComparison([a, b], { kind: 'ids', ids: [b.id, a.id] }).map(x => x.id)).toEqual([b.id, a.id]);
});
