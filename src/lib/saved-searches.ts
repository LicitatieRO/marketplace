import { z } from 'zod';
import { isValidJudet } from './judet';

const price = z.number().int().min(0).max(1_000_000_000_000);
export const savedSearchFilters = z.object({
  transaction_type: z.enum(['sale', 'rent']).optional(),
  judet: z.string().trim().min(2).max(40).refine(isValidJudet, 'Invalid judet.').optional(),
  neighborhood: z.string().trim().min(2).max(100).optional(),
  min_price_minor: price.optional(),
  max_price_minor: price.optional(),
  min_rooms: z.number().int().min(0).max(100).optional(),
}).strict().refine(value => value.min_price_minor === undefined || value.max_price_minor === undefined || value.min_price_minor <= value.max_price_minor, 'Minimum price must not exceed maximum.');
export const savedSearchInput = z.object({ name: z.string().trim().min(1).max(80), filters: savedSearchFilters }).strict();
export type SavedSearchFilters = z.infer<typeof savedSearchFilters>;
export const savedSearchRow = z.object({ id: z.uuid(), name: z.string(), filters: savedSearchFilters, created_at: z.iso.datetime({ offset: true }), last_notified_at: z.iso.datetime({ offset: true }).nullable() });
export type SavedSearch = z.infer<typeof savedSearchRow>;
