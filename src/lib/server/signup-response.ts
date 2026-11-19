import "server-only";
import { createHmac } from "node:crypto";
import type { AuthError, Session, User } from "@supabase/supabase-js";

export const SIGNUP_CHECK_EMAIL_MESSAGE =
  "Check your email to verify your account before bidding.";

/** GoTrue `weak_password` — intentionally vague (no policy detail). */
export const SIGNUP_WEAK_PASSWORD_MESSAGE = "Choose a stronger password.";

function signupLogHmacKey(): string | null {
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (secret) return secret;
  return process.env.CRON_SECRET?.trim() || null;
}

let signupHmacFallbackWarned = false;

export function hashSignupIdentifier(email: string): string {
  const key = signupLogHmacKey();
  const normalized = email.trim().toLowerCase();
  if (!key) {
    if (!signupHmacFallbackWarned) {
      signupHmacFallbackWarned = true;
      console.error("Signup handling", {
        event: "signup_log_hmac_fallback",
        warning: "server_secret_unavailable",
      });
    }
    return createHmac("sha256", "signup-log-fallback").update(normalized).digest("hex").slice(0, 16);
  }
  return createHmac("sha256", key).update(normalized).digest("hex").slice(0, 16);
}

export function isSignupPasswordPolicyError(error: AuthError | null | undefined): boolean {
  return error?.code === "weak_password";
}

export function logSignupServerEvent(
  event: string,
  details: Record<string, string | undefined>,
): void {
  const safe: Record<string, string> = { event };
  for (const [key, value] of Object.entries(details)) {
    if (value !== undefined) safe[key] = value;
  }
  console.error("Signup handling", safe);
}

export function isExistingAccountSignupError(error: AuthError | null | undefined): boolean {
  const code = error?.code ?? "";
  return code === "user_already_exists" || code === "email_exists";
}

/** GoTrue may return session:null with an empty identities array when the email is already confirmed. */
export function isObfuscatedExistingSignupSuccess(data: {
  user?: User | null;
  session?: Session | null;
}): boolean {
  if (!data.user) return false;
  if (data.session) return false;
  return (data.user.identities?.length ?? 0) === 0;
}

export function shouldScheduleExistingAccountNotice(
  error: AuthError | null | undefined,
  data: { user?: User | null; session?: Session | null } | null | undefined,
): boolean {
  if (isExistingAccountSignupError(error)) return true;
  if (!error && data && isObfuscatedExistingSignupSuccess(data)) return true;
  return false;
}
