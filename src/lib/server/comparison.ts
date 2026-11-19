import 'server-only';
import { getCatalogue } from './catalogue';
import { publicComparisonListing, type ComparisonListing } from '@/lib/listing-comparison';

/** Request-bound I/O samples time before returning an immutable public display snapshot. */
export async function getPublicComparisonSnapshot() {
  try {
    const catalogue = await getCatalogue();
    const now = Date.now();
    const options = catalogue.map(item => publicComparisonListing(item, now)).filter((item): item is ComparisonListing => Boolean(item));
    return { options, sampledAt: new Date(now).toISOString(), unavailable: false };
  } catch {
    return { options: [] as ComparisonListing[], sampledAt: new Date().toISOString(), unavailable: true };
  }
}
