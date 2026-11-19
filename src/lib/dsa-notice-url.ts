import 'server-only';
import { configuredSiteOrigin } from '@/lib/server/app-origin';
import { requestOrigin } from '@/lib/security';

export function listingUrlForId(listingId: string, origin?: string): string {
  const base = (origin ?? process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  try {
    return new URL(`/listings/${listingId}`, base).toString();
  } catch {
    return `${base}/listings/${listingId}`;
  }
}

export function listingUrlFromRequest(listingId: string, requestUrl: string): string {
  const origin = configuredSiteOrigin() ?? requestOrigin(requestUrl);
  return listingUrlForId(listingId, origin);
}
