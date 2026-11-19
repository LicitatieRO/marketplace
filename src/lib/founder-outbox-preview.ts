import {
  maskActionLinksInText,
  textContainsMaskedActionLink,
} from "@/lib/notification-preview-mask";

export type FounderOutboxClientPreview = {
  id: number;
  subject: string;
  createdAt: string;
  recipientEmail: string;
  maskedBody: string;
  hasActionLink: boolean;
};

export type FounderOutboxPreviewSource = {
  id: number;
  subject: string;
  body: string;
  created_at: string;
  recipient_email: string;
};

export function mapPreviewsForClient(
  rows: FounderOutboxPreviewSource[],
): FounderOutboxClientPreview[] {
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    createdAt: row.created_at,
    recipientEmail: row.recipient_email,
    maskedBody: maskActionLinksInText(row.body),
    hasActionLink: textContainsMaskedActionLink(row.body),
  }));
}