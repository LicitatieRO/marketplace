import { assertSameOrigin, requestOrigin } from '@/lib/security';
import { dsaNoticeSubmit } from '@/lib/dsa-notices';
import { enforceAuthHttpRateLimit } from '@/lib/server/auth-rate-limit';
import { databaseFailure, failure, json, readJson } from '@/lib/server/http';
import { submitDsaNotice } from '@/lib/server/dsa-notices-db';
import { isServiceRoleConfigured } from '@/lib/server/notifications-db';
import { listingUrlFromRequest } from '@/lib/dsa-notice-url';
import type { DsaNoticeSubmit } from '@/lib/dsa-notices';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers, requestOrigin(request.url));
    const limited = await enforceAuthHttpRateLimit(request.headers, 'dsaNotice');
    if (limited) return limited;
    if (!isServiceRoleConfigured()) {
      return json({ error: 'Supabase is not configured. Connect a backend before saving changes.' }, 503);
    }
    const body = await readJson(request);
    const parsed = dsaNoticeSubmit.parse(body);
    const input: DsaNoticeSubmit = {
      ...parsed,
      listing_url: listingUrlFromRequest(parsed.listing_id, request.url),
    };
    const receipt = await submitDsaNotice(input);
    return json({ data: receipt });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P0001') {
      return databaseFailure(error as { code?: string; message?: string });
    }
    return failure(error);
  }
}
