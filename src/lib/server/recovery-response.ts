import "server-only";
import { hashSignupIdentifier, logSignupServerEvent } from "@/lib/server/signup-response";

export const RECOVERY_GENERIC_MESSAGE =
  "If this address has an account, a recovery email will arrive shortly.";

export function hashRecoveryIdentifier(email: string): string {
  return hashSignupIdentifier(email);
}

export function logRecoveryServerEvent(
  event: string,
  details: Record<string, string | undefined>,
): void {
  logSignupServerEvent(event, details);
}
