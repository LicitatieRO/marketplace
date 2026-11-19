import type { SavedSearchFilters } from './saved-searches';
/** Fixed internal route; only approved public filters are carried through sign-in. */
export function buildSavedSearchPath(filters: SavedSearchFilters): string {
  const query = new URLSearchParams();
  for (const key of ['transaction_type', 'judet', 'neighborhood'] as const) {
    if (filters[key]) query.set(key, filters[key]);
  }
  if (filters.min_price_minor !== undefined) query.set('min_price', String(filters.min_price_minor / 100));
  if (filters.max_price_minor !== undefined) query.set('max_price', String(filters.max_price_minor / 100));
  if (filters.min_rooms !== undefined) query.set('min_rooms', String(filters.min_rooms));
  return `/saved-searches${query.size ? `?${query}` : ''}`;
}
