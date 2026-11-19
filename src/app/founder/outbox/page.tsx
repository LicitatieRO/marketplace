import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { FounderOutbox } from '@/components/founder-outbox';
import { getViewer } from '@/lib/server/auth';
import { mapPreviewsForClient } from '@/lib/founder-outbox-preview';
import { listNotificationPreviews } from '@/lib/server/notifications-db';
import { founderOutboxRouteAllowed, isStagingHost } from '@/lib/server/staging-host';

export const dynamic = 'force-dynamic';

const OUTBOX_METADATA: Metadata = {
  title: 'Staging notification outbox',
  description: 'Staff-only staging preview of undelivered notification emails.',
};

const GENERIC_METADATA: Metadata = {
  title: 'Not found',
};

async function requestHost(): Promise<string | null> {
  return (await headers()).get('host');
}

export async function generateMetadata(): Promise<Metadata> {
  if (!founderOutboxRouteAllowed(await requestHost())) return GENERIC_METADATA;
  const viewer = await getViewer();
  if (viewer?.is_staff && viewer.aal === 'aal2') return OUTBOX_METADATA;
  return GENERIC_METADATA;
}

export default async function FounderOutboxPage() {
  if (!founderOutboxRouteAllowed(await requestHost())) notFound();
  const viewer = await getViewer();
  if (!viewer?.is_staff || viewer.aal !== 'aal2') notFound();
  const previews = mapPreviewsForClient(await listNotificationPreviews(50));
  return <FounderOutbox previews={previews} revealEnabled={isStagingHost()} />;
}