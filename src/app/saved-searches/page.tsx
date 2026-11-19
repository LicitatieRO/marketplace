import { SavedSearches } from '@/components/saved-searches';
import { savedSearchFilters } from '@/lib/saved-searches';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Căutări salvate · Saved searches' };
export default async function SavedSearchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const text = (key: string) => typeof query[key] === 'string' && query[key] !== '' ? query[key] : undefined;
  const number = (key: string, factor = 1) => text(key) === undefined ? undefined : factor === 100 ? Math.round(Number(text(key)) * 100) : Number(text(key));
  const parsed = savedSearchFilters.safeParse({ transaction_type: text('transaction_type'), judet: text('judet'), neighborhood: text('neighborhood'), min_price_minor: number('min_price', 100), max_price_minor: number('max_price', 100), min_rooms: number('min_rooms') });
  return <SavedSearches initialFilters={parsed.success ? parsed.data : {}} invalidQuery={!parsed.success} />;
}
