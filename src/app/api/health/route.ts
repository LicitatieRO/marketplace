import { requestIdFor } from '@/lib/server/request-id';
import { healthSnapshot, healthStatusCode } from '@/lib/health';
import { isConfigured } from '@/lib/config';
import { getSupabase } from '@/lib/server/supabase';
import { json } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function GET(request?: Request) {
  const started = performance.now();
  const requestId = requestIdFor(request?.headers.get('x-request-id'));
  const respond = (body: ReturnType<typeof healthSnapshot>) => {
    const status = healthStatusCode(body);
    const response = json(body, status);
    response.headers.set('x-request-id', requestId);
    console.info({ level: 'info', route: '/api/health', status, durationMs: Math.max(0, Math.round(performance.now() - started)), requestId });
    return response;
  };
  if (!isConfigured()) {
    const body = healthSnapshot({ configured: false, databaseOk: false, requestId });
    return respond(body);
  }
  try {
    const db = await getSupabase();
    const { error } = await db.rpc('get_catalogue');
    const body = healthSnapshot({ configured: true, databaseOk: !error, requestId });
    return respond(body);
  } catch {
    const body = healthSnapshot({ configured: true, databaseOk: false, requestId });
    return respond(body);
  }
}