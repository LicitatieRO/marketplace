import { z } from 'zod';

export const dsaElements = [
  'photos',
  'description',
  'price_details',
  'virtual_tour',
  'seller_info',
  'whole_listing',
] as const;
export const dsaReasons = [
  'fraud',
  'misleading_info',
  'ip_infringement',
  'personal_data',
  'hate_threats',
  'csam',
  'other_illegal',
  'terms_breach',
] as const;
export const dsaStatuses = ['received', 'under_review', 'decided', 'closed'] as const;
export const dsaDecisions = [
  'no_action',
  'content_removed',
  'access_disabled',
  'listing_suspended',
  'account_suspended',
] as const;
export const dsaGroundTypes = ['legal', 'contractual'] as const;

export type DsaElement = (typeof dsaElements)[number];
export type DsaReason = (typeof dsaReasons)[number];
export type DsaStatus = (typeof dsaStatuses)[number];
export type DsaDecision = (typeof dsaDecisions)[number];
export type DsaGroundType = (typeof dsaGroundTypes)[number];

const identity = z.object({
  notifier_name: z.string().trim().min(1).max(160),
  notifier_email: z.email().max(254),
});

export const dsaNoticeSubmit = z
  .object({
    listing_id: z.uuid(),
    element: z.enum(dsaElements),
    reason: z.enum(dsaReasons),
    explanation: z.string().trim().min(30).max(5000),
    notifier_name: z.string().trim().max(160).optional(),
    notifier_email: z.string().trim().max(254).optional(),
    good_faith: z.literal(true),
  })
  .superRefine((value, ctx) => {
    if (value.reason === 'csam') return;
    const parsed = identity.safeParse({
      notifier_name: value.notifier_name ?? '',
      notifier_email: value.notifier_email ?? '',
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ ...issue, path: issue.path[0] === 'notifier_name' ? ['notifier_name'] : ['notifier_email'] });
      }
    }
  });

export const dsaNoticeReceipt = z.object({
  id: z.uuid(),
  listing_url: z.string(),
  created_at: z.string(),
});

export const dsaNoticeSummary = z.object({
  id: z.uuid(),
  listing_id: z.uuid(),
  listing_url: z.string(),
  element: z.enum(dsaElements),
  reason: z.enum(dsaReasons),
  status: z.enum(dsaStatuses),
  decision: z.enum(dsaDecisions).nullable().optional(),
  escalate_art18: z.boolean(),
  decided_at: z.string().nullable().optional(),
  created_at: z.string(),
});

export const dsaNoticeRow = dsaNoticeSummary.extend({
  explanation: z.string(),
  notifier_name: z.string().nullable().optional(),
  notifier_email: z.string().nullable().optional(),
  good_faith: z.boolean(),
  decision_facts: z.string().nullable().optional(),
  decision_ground_type: z.enum(dsaGroundTypes).nullable().optional(),
  decision_ground: z.string().nullable().optional(),
  decision_end_at: z.string().nullable().optional(),
  automated: z.boolean(),
  notifier_email_rendered: z.string().nullable().optional(),
  owner_statement_rendered: z.string().nullable().optional(),
});

export type DsaNoticeSubmitInput = z.infer<typeof dsaNoticeSubmit>;
export type DsaNoticeSubmit = DsaNoticeSubmitInput & { listing_url: string };
export type DsaNoticeRow = z.infer<typeof dsaNoticeRow>;

export const dsaNoticeUpdate = z
  .object({
    status: z.enum(dsaStatuses).optional(),
    decision: z.enum(dsaDecisions).optional(),
    decision_facts: z.string().trim().min(10).max(8000).optional(),
    decision_ground_type: z.enum(dsaGroundTypes).optional(),
    decision_ground: z.string().trim().min(3).max(8000).optional(),
    decision_end_at: z.string().datetime({ offset: true }).nullable().optional(),
    automated: z.boolean().optional(),
    escalate_art18: z.boolean().optional(),
    notifier_email_rendered: z.string().trim().min(1).max(12000).optional(),
    owner_statement_rendered: z.string().trim().min(1).max(12000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.status !== 'decided' &&
      value.status !== 'closed'
        ? true
        : Boolean(
            value.decision &&
              value.decision_facts &&
              value.decision_ground_type &&
              value.decision_ground,
          ),
    'Decision step requires decision, facts, ground type, and ground.',
  );
