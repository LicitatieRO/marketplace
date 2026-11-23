import { z } from "zod";
import { assertSameOrigin, requestOrigin, RequestError } from "@/lib/security";
import { enforceAuthHttpRateLimit } from "@/lib/server/auth-rate-limit";
import { isAccountDeleteConfirmationValid } from "@/lib/account-delete-confirmation";
import {
  accountDeleteBlockReason,
  ACCOUNT_DELETE_BLOCKED_MESSAGE,
  ACCOUNT_DELETE_DSA_NOTICE_MESSAGE,
  ACCOUNT_DELETE_HAS_HISTORY_MESSAGE,
  ACCOUNT_DELETE_NOT_FOUND_MESSAGE,
  ACCOUNT_DELETE_STAFF_MESSAGE,
  ACCOUNT_DELETE_VIEWER_UNAVAILABLE_MESSAGE,
} from "@/lib/server/account-delete-eligibility";
import { getViewer, requireSignedInUser } from "@/lib/server/auth";
import { failure, json, readJson } from "@/lib/server/http";
import { serviceRoleClient } from "@/lib/server/service-role";

export const dynamic = "force-dynamic";

const deleteSchema = z
  .object({
    confirm: z.literal(true),
    confirmation: z.string().trim().min(1).max(254),
  })
  .strict();

/**
 * Deletes the authenticated user via the service role (covers email, OAuth-only, and passkey identities).
 * App data cascades from app.profiles → auth.users when allowed.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers, requestOrigin(request.url));
    const { db, user } = await requireSignedInUser();
    const input = deleteSchema.parse(await readJson(request));
    const limited = await enforceAuthHttpRateLimit(
      request.headers,
      "accountDelete",
      user.id,
    );
    if (limited) return limited;

    const viewer = await getViewer();
    if (!viewer) {
      throw new RequestError(ACCOUNT_DELETE_VIEWER_UNAVAILABLE_MESSAGE, 403);
    }
    if (viewer.is_staff) {
      throw new RequestError(ACCOUNT_DELETE_STAFF_MESSAGE, 403);
    }

    if (!isAccountDeleteConfirmationValid(input.confirmation, user.email || "")) {
      throw new RequestError(
        "Type your account email or ȘTERGE / DELETE to confirm.",
        400,
      );
    }

    const blockReason = await accountDeleteBlockReason(user.id);
    if (blockReason === "not_found") {
      throw new RequestError(ACCOUNT_DELETE_NOT_FOUND_MESSAGE, 404);
    }
    if (blockReason === "staff") {
      throw new RequestError(ACCOUNT_DELETE_STAFF_MESSAGE, 403);
    }
    if (blockReason === "has_history") {
      // TODO(privacy-queue): enqueue founder review when table ships (#54 / #73).
      throw new RequestError(ACCOUNT_DELETE_HAS_HISTORY_MESSAGE, 409);
    }
    if (blockReason === "dsa_notices") {
      throw new RequestError(ACCOUNT_DELETE_DSA_NOTICE_MESSAGE, 409);
    }
    if (blockReason) {
      throw new RequestError(ACCOUNT_DELETE_BLOCKED_MESSAGE, 409);
    }

    let admin;
    try {
      admin = serviceRoleClient();
    } catch {
      throw new RequestError(
        "Account deletion is not configured on this environment.",
        503,
      );
    }
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      throw new RequestError("Could not delete the account.", 503);
    }
    await db.auth.signOut({ scope: "global" });
    return json({ data: { deleted: true } });
  } catch (e) {
    return failure(e);
  }
}
