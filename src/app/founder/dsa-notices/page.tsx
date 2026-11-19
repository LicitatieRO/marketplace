import type { Metadata } from 'next';
import { FounderDsaNoticeQueue } from '@/components/founder-dsa-notices';
import { requireFounderPage } from '@/lib/server/founder-access';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'DSA notice queue',
};

export default async function FounderDsaNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  await requireFounderPage();
  const params = await searchParams;
  const section = params.section === 'terms_breach' ? 'terms_breach' : 'art16';
  return <FounderDsaNoticeQueue initialSection={section} />;
}
