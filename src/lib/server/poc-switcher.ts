import {
  isProductionRuntime,
  stagingHostsAllowlistedForRequest,
} from "@/lib/server/staging-host";

function pocSwitcherFlagEnabled(): boolean {
  return process.env.POC_SWITCHER_ENABLED?.trim() === "true";
}

/** Server-only gate for POC account switcher (API + SSR). Fails closed. */
export function isPocSwitcherServerEnabled(
  requestHost: string | null | undefined,
): boolean {
  if (!pocSwitcherFlagEnabled()) return false;
  if (!isProductionRuntime()) return true;
  return stagingHostsAllowlistedForRequest(requestHost);
}