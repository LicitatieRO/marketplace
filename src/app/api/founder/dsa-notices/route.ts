import { z } from 'zod';
import { assertSameOrigin, requestOrigin } from '@/lib/security';
import { dsaNoticeUpdate, dsaStatuses } from '@/lib/dsa-notices';
import { databaseFailure, failure, json, readJson } from '@/lib/server/http';
import { listDsaNotices, updateDsaNotice } from '@/lib/server/dsa-notices-db';
import { requireFounderSession } from '@/lib/server/founder-access';

export const dynamic = 'force-dynamic';

const listQuery = z.object({
  status: z.enum(dsaStatuses).optional(),
  section: z.enum(['all', 'art16', 'terms_breach']).optional(),
});

export async function GET(request: Request) {
  try {
    const { db } = await requireFounderSession();
    const url = new URL(request.url);
    const query = listQuery.parse({
      status: url.searchParams.get('status') ?? undefined,
      section: url.searchParams.get('section') ?? undefined,
    });
    const data = await listDsaNotices(db, {
      status: query.status,
      section: query.section ?? 'all',
    });
    return json({ data });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request.headers, requestOrigin(request.url));
    const { db } = await requireFounderSession();
    const body = z
      .object({ id: z.uuid(), patch: dsaNoticeUpdate })
      .strict()
      .parse(await readJson(request));
    const data = await updateDsaNotice(db, body.id, body.patch);
    return json({ data });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      return databaseFailure(error as { code?: string; message?: string });
    }
    return failure(error);
  }
}
