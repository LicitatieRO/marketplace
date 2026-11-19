import { databaseFailure, failure, json } from '@/lib/server/http';
import { getDsaNotice } from '@/lib/server/dsa-notices-db';
import { requireFounderSession } from '@/lib/server/founder-access';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { db } = await requireFounderSession();
    const { id } = await context.params;
    const data = await getDsaNotice(db, id);
    if (!data) return json({ error: 'Notice not found' }, 404);
    return json({ data });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      return databaseFailure(error as { code?: string; message?: string });
    }
    return failure(error);
  }
}
