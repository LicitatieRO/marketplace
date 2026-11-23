import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('aalForMfaUnenroll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs MFA_UNENROLL_CLAIMS_ERROR and fails closed to aal1 when getClaims errors', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { aalForMfaUnenroll } = await import('@/lib/server/mfa-unenroll');
    expect(
      aalForMfaUnenroll({
        data: null,
        error: { message: 'session broken' },
      }),
    ).toBe('aal1');
    expect(errorSpy).toHaveBeenCalledWith('mfa.unenroll_claims_failed', {
      reason: 'MFA_UNENROLL_CLAIMS_ERROR',
    });
    expect(errorSpy.mock.calls[0]?.[1]).toEqual({ reason: 'MFA_UNENROLL_CLAIMS_ERROR' });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('session broken');
  });

  it('returns aal2 when claims include aal2', async () => {
    const { aalForMfaUnenroll } = await import('@/lib/server/mfa-unenroll');
    expect(
      aalForMfaUnenroll({
        data: { claims: { aal: 'aal2' } },
        error: null,
      }),
    ).toBe('aal2');
  });
});
