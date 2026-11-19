import { expect, it } from 'vitest';
import { buildSavedSearchPath } from '@/lib/saved-search-link';
it('keeps approved filters when returning through authentication', () => {
  const url = new URL(buildSavedSearchPath({ transaction_type: 'rent', neighborhood: 'Bucureștii Noi', max_price_minor: 80010, min_rooms: 0 }), 'https://licitatiero.example');
  expect(url.pathname).toBe('/saved-searches');
  expect(url.searchParams.get('neighborhood')).toBe('Bucureștii Noi');
  expect(url.searchParams.get('max_price')).toBe('800.1');
  expect(url.searchParams.get('min_rooms')).toBe('0');
});
it('uses a fixed internal route for an empty search', () => {
  expect(buildSavedSearchPath({})).toBe('/saved-searches');
});
