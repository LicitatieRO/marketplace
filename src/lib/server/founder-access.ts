import 'server-only';

import { notFound } from 'next/navigation';
import { requireUser, getViewer } from '@/lib/server/auth';
import { RequestError } from '@/lib/security';

function founderReady(viewer: Awaited<ReturnType<typeof getViewer>>) {
  return Boolean(viewer?.is_staff && viewer.aal === 'aal2');
}

export async function requireFounderPage() {
  const viewer = await getViewer();
  if (!founderReady(viewer)) notFound();
  return viewer!;
}

export async function requireFounderSession() {
  const viewer = await getViewer();
  if (!founderReady(viewer)) throw new RequestError('Staff MFA required', 403);
  const { db } = await requireUser();
  return { db, viewer: viewer! };
}
