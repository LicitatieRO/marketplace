import "server-only";
import { safeReturnPath } from "@/lib/security";
import { notificationServiceClient } from "@/lib/server/notifications-db";
import {
  assertStagingHostForActionLinkPreview,
  signupActionLinkAllowed,
} from "@/lib/server/staging-signup-link";
import {
  hashSignupIdentifier,
  logSignupServerEvent,
} from "@/lib/server/signup-response";

const SIGNUP_CONFIRM_SUBJECT =
  "LicitatieRO — confirmă contul / confirm your account";

const EXISTING_ACCOUNT_PREVIEW_BODY = [
  "Încercare de înregistrare pentru un cont existent (staging).",
  "Sign-up attempted for an existing account (staging).",
  "",
  "Nu este inclus niciun link de confirmare sau token.",
  "No confirmation link or token is included.",
].join("\n");

export function buildStagingSignupRedirectTo(
  next?: string,
  redirectTo?: string,
): string | null {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) return null;
  const nextPath = encodeURIComponent(safeReturnPath(next, redirectTo));
  return `${appUrl.replace(/\/$/, "")}/auth/callback?next=${nextPath}`;
}

function previewBody(actionLink: string): string {
  return [
    "Confirmă adresa de email pentru contul LicitatieRO (staging).",
    "Confirm your LicitatieRO account email (staging).",
    "",
    actionLink,
    "",
    "Link-ul expiră conform politicii Supabase Auth. / The link expires per Supabase Auth policy.",
  ].join("\n");
}

export type StagingSignupAwaitedResult =
  | { kind: "completed" }
  | { kind: "existing_account"; email: string; emailHash: string }
  | { kind: "password_policy" };

async function resolveAuthUserIdByEmail(
  db: ReturnType<typeof notificationServiceClient>,
  email: string,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit?.id) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function stagingSignupWithOutboxLink(input: {
  email: string;
  password: string;
  displayName?: string;
  next?: string;
  redirectTo?: string;
}): Promise<StagingSignupAwaitedResult> {
  const emailHash = hashSignupIdentifier(input.email);
  const redirectTo = buildStagingSignupRedirectTo(input.next, input.redirectTo);
  if (!redirectTo) {
    logSignupServerEvent("staging_signup_config", {
      emailHash,
      reason: "app_url_missing",
    });
    return { kind: "completed" };
  }

  const db = notificationServiceClient();
  const { data, error } = await db.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: {
      redirectTo,
      data: { display_name: input.displayName || "Member" },
    },
  });

  if (error || !data?.user?.id) {
    logSignupServerEvent("staging_signup_generate_link", {
      emailHash,
      userId: data?.user?.id,
      reason: error?.code ?? "missing_user",
    });
    if (error?.code === "weak_password") {
      return { kind: "password_policy" };
    }
    return { kind: "existing_account", email: input.email, emailHash };
  }

  const actionLink = data.properties?.action_link;
  if (!actionLink) {
    logSignupServerEvent("staging_signup_generate_link", {
      emailHash,
      userId: data.user.id,
      reason: "missing_action_link",
    });
    return { kind: "completed" };
  }

  if (!signupActionLinkAllowed(actionLink, redirectTo)) {
    logSignupServerEvent("staging_signup_preview", {
      emailHash,
      userId: data.user.id,
      reason: "action_link_rejected",
    });
    return { kind: "completed" };
  }

  try {
    assertStagingHostForActionLinkPreview();
  } catch {
    logSignupServerEvent("staging_signup_preview", {
      emailHash,
      userId: data.user.id,
      reason: "host_guard",
    });
    return { kind: "completed" };
  }

  const { data: stored, error: previewError } = await db.rpc(
    "store_staging_signup_notification_preview",
    {
      p_user_id: data.user.id,
      p_subject: SIGNUP_CONFIRM_SUBJECT,
      p_body: previewBody(actionLink),
      p_recipient_email: input.email,
    },
  );

  if (previewError || stored !== true) {
    logSignupServerEvent("staging_signup_preview", {
      emailHash,
      userId: data.user.id,
      reason: previewError?.code ?? "store_failed",
    });
  }

  return { kind: "completed" };
}

export async function stagingExistingAccountOutboxNotice(input: {
  email: string;
  emailHash: string;
}): Promise<void> {
  try {
    const db = notificationServiceClient();
    const userId = await resolveAuthUserIdByEmail(db, input.email);
    if (!userId) {
      logSignupServerEvent("staging_existing_account_notice_failed", {
        emailHash: input.emailHash,
        reason: "user_not_found",
      });
      return;
    }
    try {
      assertStagingHostForActionLinkPreview();
    } catch {
      logSignupServerEvent("staging_existing_account_notice_failed", {
        emailHash: input.emailHash,
        userId,
        reason: "host_guard",
      });
      return;
    }
    const { data: stored, error: previewError } = await db.rpc(
      "store_staging_signup_notification_preview",
      {
        p_user_id: userId,
        p_subject: SIGNUP_CONFIRM_SUBJECT,
        p_body: EXISTING_ACCOUNT_PREVIEW_BODY,
        p_recipient_email: input.email,
      },
    );
    if (previewError || stored !== true) {
      logSignupServerEvent("staging_existing_account_notice_failed", {
        emailHash: input.emailHash,
        userId,
        reason: previewError?.code ?? "store_failed",
      });
    }
  } catch {
    logSignupServerEvent("staging_existing_account_notice_failed", {
      emailHash: input.emailHash,
      reason: "exception",
    });
  }
}
