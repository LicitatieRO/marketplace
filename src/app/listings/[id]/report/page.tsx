import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { DsaReportForm } from '@/components/dsa-report-form';
import { getListing } from '@/lib/server/catalogue';
import { listingUrlFromRequest } from '@/lib/dsa-notice-url';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Raportează conținut ilegal | Report illegal content' };
}

export default async function ListingReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();
  const host = (await headers()).get('x-forwarded-host') ?? (await headers()).get('host');
  const proto = (await headers()).get('x-forwarded-proto') ?? 'http';
  const requestUrl = host ? `${proto}://${host}/listings/${id}/report` : `http://localhost:3000/listings/${id}/report`;
  const listingUrl = listingUrlFromRequest(id, requestUrl);
  return (
    <main id="main" className="page-width" style={{ padding: '32px 0' }}>
      <Link href={`/listings/${id}`} className="text-button">
        ← {`Raportează conținut ilegal | Report illegal content`.split(' | ')[0]}
      </Link>
      <h1 style={{ margin: '20px 0' }}>Raportează conținut ilegal | Report illegal content</h1>
      <DsaReportForm listingId={id} listingUrl={listingUrl} />
    </main>
  );
}
