import { describe, expect, it } from 'vitest';
import { parseSealedOffers, sortSealedOffers } from '@/lib/sealed-offers';
const a = { id: '37000000-0000-4000-8000-000000000001', bidder_display_name: 'Alpha', amount_minor: 10000, created_at: '2026-11-16T06:00:00Z' };
const b = { ...a, id: '37000000-0000-4000-8000-000000000002', bidder_display_name: 'Beta', amount_minor: 20000, created_at: '2026-11-16T06:01:00Z' };

describe('confidential offer read contract', () => {
  it('accepts an empty authorized response without inventing an offer', () => {
    expect(parseSealedOffers([])).toEqual([]);
    expect(parseSealedOffers([a])).toEqual([a]);
  });
  it.each([null, [{}], [{ ...a, amount_minor: 0 }], [{ ...a, amount_minor: '10000' }], [{ ...a, amount_minor: Infinity }], [{ ...a, created_at: 'invalid' }]])('rejects invalid rows rather than displaying zero placeholders', (data) => {
    expect(() => parseSealedOffers(data)).toThrow('Invalid confidential offers response.');
  });
  it('strips extra server properties from the rendered contract', () => {
    expect(parseSealedOffers([{ ...a, email: 'not-for-client@example.test' }])).toEqual([a]);
  });
});
describe('read-only comparison sorting', () => {
  it('sorts by amount and time in both directions without changing input', () => {
    const rows = [a, b];
    expect(sortSealedOffers(rows, 'amountDesc').map(x => x.id)).toEqual([b.id, a.id]);
    expect(sortSealedOffers(rows, 'amountAsc').map(x => x.id)).toEqual([a.id, b.id]);
    expect(sortSealedOffers(rows, 'timeDesc').map(x => x.id)).toEqual([b.id, a.id]);
    expect(sortSealedOffers(rows, 'timeAsc').map(x => x.id)).toEqual([a.id, b.id]);
    expect(rows).toEqual([a, b]);
  });
  it('breaks equal amount/time ties by stable bid ID', () => {
    const tied = { ...a, id: b.id };
    expect(sortSealedOffers([tied, a], 'amountDesc').map(x => x.id)).toEqual([a.id, b.id]);
  });
});
