import type { Metadata } from 'next';
import { FounderDsaNoticeDetail } from '@/components/founder-dsa-notices';
import { requireFounderPage } from '@/lib/server/founder-access';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'DSA notice detail',
};

export default async function FounderDsaNoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFounderPage();
  const { id } = await params;
  return <FounderDsaNoticeDetail noticeId={id} />;
}
