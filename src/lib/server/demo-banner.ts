import {
  isProductionRuntime,
  stagingHostsAllowlistedForRequest,
} from "@/lib/server/staging-host";

function demoBannerFlagEnabled(): boolean {
  const value = process.env.DEMO_BANNER?.trim();
  if (!value) return false;
  return value === "1";
}

/**
 * Opt-in pitch strip. Same staging deployment marker as POC switcher and mock payments:
 * on production runtime, APP_URL and request Host must both match STAGING_HOST_ALLOWLIST.
 */
export function isStagingDemoBannerEnabled(
  requestHost: string | null | undefined,
): boolean {
  if (!demoBannerFlagEnabled()) return false;
  if (!isProductionRuntime()) return true;
  return stagingHostsAllowlistedForRequest(requestHost);
}
