import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendStandardExistingAccountRecoveryNotice } from "@/lib/server/recovery-email";
import { hashSignupIdentifier, logSignupServerEvent } from "@/lib/server/signup-response";

export async function sendStandardExistingAccountNotice(
  email: string,
  requestHost: string | null | undefined,
  userDb: SupabaseClient,
  redirectOrigin: string,
): Promise<void> {
  const emailHash = hashSignupIdentifier(email);
  try {
    await sendStandardExistingAccountRecoveryNotice(
      email,
      requestHost,
      userDb,
      redirectOrigin,
    );
  } catch {
    logSignupServerEvent("standard_signup_notice_failed", {
      emailHash,
      reason: "recover_exception",
    });
  }
}
