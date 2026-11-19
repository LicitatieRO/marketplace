import { describe, expect, it } from 'vitest';
import { dsaNoticeSubmit, dsaNoticeUpdate } from '@/lib/dsa-notices';

const base = {
  listing_id: '20000000-0000-4000-8000-000000000001',
  element: 'description' as const,
  reason: 'fraud' as const,
  explanation: 'This listing misstates ownership and requests advance payment off-platform.',
  notifier_name: 'Alex Reporter',
  notifier_email: 'alex@example.test',
  good_faith: true as const,
};

describe('dsaNoticeSubmit', () => {
  it('requires notifier identity except for csam', () => {
    expect(() => dsaNoticeSubmit.parse({ ...base, notifier_name: '', notifier_email: '' })).toThrow();
    expect(
      dsaNoticeSubmit.parse({
        ...base,
        reason: 'csam',
        notifier_name: undefined,
        notifier_email: undefined,
      }),
    ).toMatchObject({ reason: 'csam' });
  });

  it('enforces minimum explanation length', () => {
    expect(() => dsaNoticeSubmit.parse({ ...base, explanation: 'too short' })).toThrow();
  });

  it('strips client-supplied listing_url from the payload', () => {
    const parsed = dsaNoticeSubmit.parse({
      ...base,
      listing_url: 'https://evil.test/phishing',
    });
    expect(parsed).not.toHaveProperty('listing_url');
  });
});

describe('dsaNoticeUpdate', () => {
  it('requires decision fields when closing', () => {
    expect(() =>
      dsaNoticeUpdate.parse({
        status: 'decided',
        decision: 'no_action',
        decision_facts: 'short',
        decision_ground_type: 'legal',
        decision_ground: 'Law',
      }),
    ).toThrow();
    expect(
      dsaNoticeUpdate.parse({
        status: 'closed',
        decision: 'content_removed',
        decision_facts: 'Photos were copied from a third-party brokerage website.',
        decision_ground_type: 'contractual',
        decision_ground: '4.2',
      }),
    ).toMatchObject({ status: 'closed' });
  });
});
