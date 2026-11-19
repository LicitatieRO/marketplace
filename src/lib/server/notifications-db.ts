import 'server-only';

import { serviceRoleClient } from '@/lib/server/service-role';

export { serviceRoleClient };

export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY?.trim());
}

export function notificationServiceClient() {
  return serviceRoleClient();
}

export type NotificationPreviewRow = {
  id: number;
  notification_id: number;
  subject: string;
  body: string;
  created_at: string;
  recipient_email: string;
};

function normalizePreviewRow(raw: Record<string, unknown>): NotificationPreviewRow {
  const recipient =
    (typeof raw.recipient_email === 'string' && raw.recipient_email) ||
    (typeof raw.recipientEmail === 'string' && raw.recipientEmail) ||
    '';
  return {
    id: Number(raw.id),
    notification_id: Number(raw.notification_id ?? raw.notificationId),
    subject: String(raw.subject ?? ''),
    body: String(raw.body ?? ''),
    created_at: String(raw.created_at ?? raw.createdAt ?? ''),
    recipient_email: recipient,
  };
}

export async function listNotificationPreviews(limit = 50): Promise<NotificationPreviewRow[]> {
  const db = notificationServiceClient();
  const { data, error } = await db.rpc('list_notification_previews', { p_limit: limit });
  if (error) throw new Error('Preview listing failed.');
  if (!Array.isArray(data)) return [];
  return data.map((row) => normalizePreviewRow(row as Record<string, unknown>));
}
