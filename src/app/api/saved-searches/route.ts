import { z } from 'zod';
import { assertSameOrigin, requestOrigin } from '@/lib/security';
import { requireUser } from '@/lib/server/auth';
import { databaseFailure, failure, json, readJson } from '@/lib/server/http';
import { savedSearchInput, savedSearchRow } from '@/lib/saved-searches';
export const dynamic = 'force-dynamic';
function savedSearchDatabaseFailure(error: { code?: string; message?: string }) {
  if (error.code === 'P0001' && error.message === 'Saved search capacity reached') return json({ error: 'Saved search capacity reached' }, 409);
  if (error.code === 'P0001' && error.message === 'Saved search limit reached') return json({ error: 'Saved search limit reached' }, 409);
  return databaseFailure(error);
}
export async function GET() {
  try {
    const { db } = await requireUser();
    const { data, error } = await db.rpc('get_saved_searches');
    return error ? databaseFailure(error) : json({ data: savedSearchRow.array().parse(data) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers, requestOrigin(request.url));
    const { db } = await requireUser();
    const input = savedSearchInput.parse(await readJson(request));
    const { data, error } = await db.rpc('save_saved_search', { p_name: input.name, p_filters: input.filters });
    return error ? savedSearchDatabaseFailure(error) : json({ data: savedSearchRow.parse(data) });
  } catch (error) { return failure(error); }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request.headers, requestOrigin(request.url));
    const { db } = await requireUser();
    const { id } = z.object({ id: z.uuid() }).strict().parse(await readJson(request));
    const { data, error } = await db.rpc('delete_saved_search', { p_id: id });
    return error ? databaseFailure(error) : json({ data: { deleted: z.boolean().parse(data) } });
  } catch (error) { return failure(error); }
}
