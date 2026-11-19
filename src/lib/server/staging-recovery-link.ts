import {
  configuredAppHostname,
  isProductionRuntime,
  requestHostProvided,
  stagingHostsAllowlistedForRequest,
} from "@/lib/server/staging-host";
import { strictTruthyEnv } from "@/lib/server/staging-signup-link";

function stagingOutboxDeliveryMode(): boolean {
  return process.env.EMAIL_DELIVERY_MODE?.trim() === "staging_outbox";
}

function appSentRecoveryFlagEnabled(): boolean {
  return strictTruthyEnv("APP_SENT_RECOVERY_ENABLED");
}

/** Server-only gate for app-sent recovery links in the notification outbox. Fails closed. */
export function isAppSentRecoveryEnabled(
  requestHost: string | null | undefined,
): boolean {
  if (!appSentRecoveryFlagEnabled() || !stagingOutboxDeliveryMode()) {
    return false;
  }
  if (!isProductionRuntime()) return true;
  if (!configuredAppHostname()) return false;
  if (!requestHostProvided(requestHost)) return false;
  return stagingHostsAllowlistedForRequest(requestHost);
}
