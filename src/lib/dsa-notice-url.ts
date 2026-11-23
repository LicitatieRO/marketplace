import 'server-only';
import { RequestError } from '@/lib/security';
import { configuredSiteOrigin } from '@/lib/server/app-origin';

export function listingUrlForId(listingId: string, origin?: string): string {
  const base = (origin ?? process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  try {
    return new URL(`/listings/${listingId}`, base).toString();
  } catch {
    return `${base}/listings/${listingId}`;
  }
}

export function listingUrlFromRequest(listingId: string, requestUrl: string): string {
  void requestUrl;
  const origin = configuredSiteOrigin();
  if (!origin) {
    throw new RequestError('APP_URL must be configured.', 503);
  }
  return listingUrlForId(listingId, origin);
}
