import { getPublicComparisonSnapshot } from '@/lib/server/comparison';
import { parseComparisonQuery, selectComparison } from '@/lib/listing-comparison';
import { ListingComparison } from '@/components/listing-comparison';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Compară locuințe · Compare listings' };
export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string | string[]; property?: string | string[] }> }) {
  const query = parseComparisonQuery(await searchParams);
  const snapshot = await getPublicComparisonSnapshot();
  return <ListingComparison {...snapshot} selected={selectComparison(snapshot.options, query)} query={query} />;
}
