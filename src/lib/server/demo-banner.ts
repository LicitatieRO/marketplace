import { isProductionRuntime } from "@/lib/server/staging-host";

function demoBannerFlagEnabled(): boolean {
  return process.env.DEMO_BANNER?.trim() === "1";
}

/** Opt-in staging pitch strip; off on production runtime even when the flag is set. */
export function isStagingDemoBannerEnabled(): boolean {
  if (!demoBannerFlagEnabled()) return false;
  if (isProductionRuntime()) return false;
  return true;
}
