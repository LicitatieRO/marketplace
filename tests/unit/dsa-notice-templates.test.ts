import { describe, expect, it } from 'vitest';
import { renderNotifierDecisionEmail, renderOwnerStatementOfReasons } from '@/lib/dsa-notice-templates';

describe('dsa notice templates', () => {
  it('renders notifier decision email without leaking owner identity', () => {
    const body = renderNotifierDecisionEmail({
      language: 'en',
      id: 'notice-1',
      decision: 'no_action',
      shortReason: 'No infringement found.',
    });
    expect(body.en).toContain('ref. notice-1');
    expect(body.en).toContain('No action');
    expect(body.en).not.toContain('owner');
  });

  it('renders owner statement without notifier identity', () => {
    const body = renderOwnerStatementOfReasons({
      listingUrl: 'https://example.test/listings/x',
      decision: 'content_removed',
      dateIso: '2026-11-16T10:00:00.000Z',
      facts: 'Copied photos were removed after review.',
      groundType: 'legal',
      ground: 'Copyright Law',
      automated: false,
      followedNotice: true,
    });
    expect(body.ro).toContain('Faptele avute în vedere');
    expect(body.en).toContain('Facts relied on');
    expect(body.en).not.toMatch(/notifier|reporter/i);
  });
});
