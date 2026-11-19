import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRecoveryCallbackUrl, configuredSiteOrigin } from "@/lib/server/app-origin";
import { notificationServiceClient } from "@/lib/server/notifications-db";
import { assertStagingHostForActionLinkPreview } from "@/lib/server/staging-signup-link";
import {
  hashRecoveryIdentifier,
  logRecoveryServerEvent,
} from "@/lib/server/recovery-response";
import { isAppSentRecoveryEnabled } from "@/lib/server/staging-recovery-link";

export const RECOVERY_PREVIEW_SUBJECT =
  "LicitatieRO — resetează parola / reset your password";

function recoveryPreviewBody(recoveryLink: string): string {
  return [
    "Resetează parola contului LicitatieRO (staging).",
    "Reset your LicitatieRO account password (staging).",
    "",
    recoveryLink,
    "",
    "Link-ul expiră conform politicii Supabase Auth. / The link expires per Supabase Auth policy.",
  ].join("\n");
}

async function storeRecoveryPreview(input: {
  userId: string;
  email: string;
  emailHash: string;
  recoveryLink: string;
}): Promise<void> {
  try {
    assertStagingHostForActionLinkPreview();
  } catch {
    logRecoveryServerEvent("app_sent_recovery_preview", {
      emailHash: input.emailHash,
      userId: input.userId,
      reason: "host_guard",
    });
    return;
  }
  const db = notificationServiceClient();
  const { data: stored, error: previewError } = await db.rpc(
    "store_staging_recovery_notification_preview",
    {
      p_user_id: input.userId,
      p_subject: RECOVERY_PREVIEW_SUBJECT,
      p_body: recoveryPreviewBody(input.recoveryLink),
      p_recipient_email: input.email,
    },
  );
  if (previewError || stored !== true) {
    logRecoveryServerEvent("app_sent_recovery_preview", {
      emailHash: input.emailHash,
      userId: input.userId,
      reason: previewError?.code ?? "store_failed",
    });
  }
}

export async function sendAppSentRecoveryEmail(
  email: string,
  requestHost: string | null | undefined,
): Promise<void> {
  const emailHash = hashRecoveryIdentifier(email);
  if (!isAppSentRecoveryEnabled(requestHost)) {
    logRecoveryServerEvent("app_sent_recovery_skipped", {
      emailHash,
      reason: "gate_off",
    });
    return;
  }
  if (!configuredSiteOrigin()) {
    logRecoveryServerEvent("app_sent_recovery_skipped", {
      emailHash,
      reason: "app_origin_missing",
    });
    return;
  }
  let db: ReturnType<typeof notificationServiceClient>;
  try {
    db = notificationServiceClient();
  } catch {
    logRecoveryServerEvent("app_sent_recovery_skipped", {
      emailHash,
      reason: "service_role_missing",
    });
    return;
  }

  const { data: cooldownActive, error: cooldownError } = await db.rpc(
    "recovery_generate_link_cooldown_active",
    { p_email: email },
  );
  if (!cooldownError && cooldownActive === true) {
    logRecoveryServerEvent("app_sent_recovery_cooldown", { emailHash });
    return;
  }

  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error) {
    logRecoveryServerEvent("app_sent_recovery_generate_link", {
      emailHash,
      reason: error.code ?? "generate_link_failed",
    });
    return;
  }

  const hashedToken = data?.properties?.hashed_token;
  const userId = data?.user?.id;
  if (!hashedToken || !userId) {
    logRecoveryServerEvent("app_sent_recovery_generate_link", {
      emailHash,
      userId,
      reason: !hashedToken ? "missing_hashed_token" : "missing_user",
    });
    return;
  }

  const recoveryLink = buildRecoveryCallbackUrl(hashedToken);
  if (!recoveryLink) {
    logRecoveryServerEvent("app_sent_recovery_generate_link", {
      emailHash,
      userId,
      reason: "callback_url_failed",
    });
    return;
  }

  await storeRecoveryPreview({ userId, email, emailHash, recoveryLink });
}

export async function sendLegacyPasswordRecoveryEmail(
  db: SupabaseClient,
  email: string,
  redirectOrigin: string,
): Promise<void> {
  const emailHash = hashRecoveryIdentifier(email);
  const resetNext = encodeURIComponent("/account?mode=reset");
  try {
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: `${redirectOrigin}/auth/callback?next=${resetNext}`,
    });
    if (error) {
      logRecoveryServerEvent("legacy_recovery_failed", {
        emailHash,
        reason: error.code ?? "recover_failed",
      });
    }
  } catch {
    logRecoveryServerEvent("legacy_recovery_failed", {
      emailHash,
      reason: "recover_exception",
    });
  }
}

export async function sendStandardExistingAccountRecoveryNotice(
  email: string,
  requestHost: string | null | undefined,
  userDb: SupabaseClient,
  redirectOrigin: string,
): Promise<void> {
  if (isAppSentRecoveryEnabled(requestHost)) {
    await sendAppSentRecoveryEmail(email, requestHost);
    return;
  }
  await sendLegacyPasswordRecoveryEmail(userDb, email, redirectOrigin);
}
