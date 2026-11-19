import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceRoleClient } from '@/lib/server/service-role';
import type { DsaNoticeRow, DsaNoticeSubmit } from '@/lib/dsa-notices';
import { dsaNoticeReceipt, dsaNoticeRow, dsaNoticeSummary } from '@/lib/dsa-notices';

export async function submitDsaNotice(input: DsaNoticeSubmit) {
  const db = serviceRoleClient();
  const { data, error } = await db.rpc('submit_dsa_notice', {
    p_listing_id: input.listing_id,
    p_listing_url: input.listing_url,
    p_element: input.element,
    p_reason: input.reason,
    p_explanation: input.explanation,
    p_notifier_name: input.notifier_name ?? '',
    p_notifier_email: input.notifier_email ?? '',
    p_good_faith: input.good_faith,
  });
  if (error) throw error;
  return dsaNoticeReceipt.parse(data);
}

export async function listDsaNotices(
  db: SupabaseClient,
  params: {
    status?: string;
    section?: 'all' | 'art16' | 'terms_breach';
    limit?: number;
  },
) {
  const { data, error } = await db.rpc('list_dsa_notices', {
    p_status: params.status ?? '',
    p_section: params.section ?? 'all',
    p_limit: params.limit ?? 50,
  });
  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map((row) => dsaNoticeSummary.parse(row));
}

export async function getDsaNotice(db: SupabaseClient, id: string): Promise<DsaNoticeRow | null> {
  const { data, error } = await db.rpc('get_dsa_notice', { p_id: id });
  if (error) throw error;
  if (!data) return null;
  return dsaNoticeRow.parse(data);
}

export async function updateDsaNotice(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<DsaNoticeRow> {
  const { data, error } = await db.rpc('update_dsa_notice', {
    p_id: id,
    p_status: patch.status ?? null,
    p_decision: patch.decision ?? null,
    p_decision_facts: patch.decision_facts ?? null,
    p_decision_ground_type: patch.decision_ground_type ?? null,
    p_decision_ground: patch.decision_ground ?? null,
    p_decision_end_at: patch.decision_end_at ?? null,
    p_automated: patch.automated ?? null,
    p_escalate_art18: patch.escalate_art18 ?? null,
    p_notifier_email_rendered: patch.notifier_email_rendered ?? null,
    p_owner_statement_rendered: patch.owner_statement_rendered ?? null,
  });
  if (error) throw error;
  return dsaNoticeRow.parse(data);
}
