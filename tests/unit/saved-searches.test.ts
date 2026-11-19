import { describe, expect, it } from 'vitest';
import { savedSearchInput } from '@/lib/saved-searches';
describe('private saved-search filter contract', () => {
  it('accepts public listing filters and trims labels', () => {
    expect(savedSearchInput.parse({ name: ' My rent ', filters: { transaction_type: 'rent', neighborhood: ' Cotroceni ', max_price_minor: 80000, min_rooms: 2 } })).toEqual({ name: 'My rent', filters: { transaction_type: 'rent', neighborhood: 'Cotroceni', max_price_minor: 80000, min_rooms: 2 } });
  });
  it.each([
    { exact_address: 'private address' }, { amount_minor: 100 }, { owner_id: 'other' },
    { min_price_minor: -1 }, { min_price_minor: 200, max_price_minor: 100 },
    { transaction_type: 'auction' }, { min_rooms: 101 }, { max_price_minor: 1.5 }, { judet: 'not-a-county' },
  ])('rejects personal fields or invalid bounds', (filters) => {
    expect(savedSearchInput.safeParse({ name: 'Test', filters }).success).toBe(false);
  });
  it('rejects caller-supplied ownership and empty names', () => {
    expect(savedSearchInput.safeParse({ name: 'Test', filters: {}, user_id: 'other' }).success).toBe(false);
    expect(savedSearchInput.safeParse({ name: ' ', filters: {} }).success).toBe(false);
  });
});
