import { z } from "zod";
import { maskActionLinksInText } from "@/lib/notification-preview-mask";
import { RequestError } from "@/lib/security";
import { getViewer } from "@/lib/server/auth";
import { failure, json } from "@/lib/server/http";
import {
  founderOutboxRouteAllowed,
  isStagingHost,
} from "@/lib/server/staging-host";
import {
  listNotificationPreviews,
  notificationServiceClient,
} from "@/lib/server/notifications-db";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  previewId: z.number().int().positive(),
});

export async function POST(request: Request) {
  try {
    const requestHost = (await headers()).get("host");
    if (!founderOutboxRouteAllowed(requestHost)) {
      return failure(new RequestError("Not found", 404));
    }
    const viewer = await getViewer();
    if (!viewer?.is_staff || viewer.aal !== "aal2") {
      return failure(new RequestError("Not found", 404));
    }
    if (!isStagingHost()) {
      return failure(new RequestError("Not available", 503));
    }
    const parsed = bodySchema.parse(await request.json());
    const rows = await listNotificationPreviews(100);
    const row = rows.find((item) => item.id === parsed.previewId);
    if (!row) {
      return failure(new RequestError("Not found", 404));
    }
    const db = notificationServiceClient();
    const { error: auditError } = await db.rpc(
      "audit_notification_preview_link_reveal",
      {
        p_actor_id: viewer.id,
        p_preview_id: parsed.previewId,
      },
    );
    if (auditError) {
      return failure(new RequestError("Reveal audit failed", 503));
    }
    return json({
      data: {
        id: row.id,
        body: row.body,
        maskedBody: maskActionLinksInText(row.body),
      },
    });
  } catch (error) {
    return failure(error);
  }
}