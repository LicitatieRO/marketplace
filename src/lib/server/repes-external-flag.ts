import "server-only";
import { strictTruthyEnv } from "@/lib/server/staging-signup-link";
import {
  isProductionRuntime,
  stagingHostsAllowlistedForRequest,
} from "@/lib/server/staging-host";

/** Defaults OFF; on production only when REPES_EXTERNAL_AUCTIONS_ENABLED=true and staging host allowlist matches. */
export function isRepesExternalAuctionsEnabled(
  requestHost: string | null | undefined,
): boolean {
  if (!strictTruthyEnv("REPES_EXTERNAL_AUCTIONS_ENABLED")) return false;
  if (!isProductionRuntime()) return true;
  return stagingHostsAllowlistedForRequest(requestHost);
}

export const REPES_EXTERNAL_AUCTIONS_ENV = "REPES_EXTERNAL_AUCTIONS_ENABLED";