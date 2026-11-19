import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const unenrollMfaFactor = vi.fn();
const recordMfaFactorUnenrolledAudit = vi.fn();

vi.mock('@/lib/server/mfa-unenroll', () => ({
  unenrollMfaFactor,
  recordMfaFactorUnenrolledAudit,
  MFA_UNENROLL_SESSION_REFRESH:
    'Authenticator removed. Sign in again to refresh your session.',
}));

vi.mock('@/lib/server/mfa-staff-guard', () => ({
  resolveIsStaffForMfaUnenroll: () => true,
}));

vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({
    user: {
      id: '10000000-0000-4000-8000-000000000001',
      email_confirmed_at: new Date().toISOString(),
    },
    db: {
      auth: { getClaims: async () => ({ data: { claims: { aal: 'aal2' } } }) },
      rpc: async (name: string) => {
        if (name === 'get_workspace') {
          return { data: { profile: { is_staff: true } }, error: null };
        }
        return { data: null, error: null };
      },
    },
  }),
}));

vi.mock('@/lib/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return {
    ...actual,
    requestOrigin: () => 'https://licitatiero.ro',
  };
});

afterEach(() => {
  unenrollMfaFactor.mockReset();
  recordMfaFactorUnenrolledAudit.mockReset();
});

describe('POST /api/mfa unenroll', () => {
  it('delegates unenroll with staff flag and aal from the session', async () => {
    unenrollMfaFactor.mockResolvedValue({ sessionRefreshFailed: false });
    recordMfaFactorUnenrolledAudit.mockResolvedValue(undefined);
    const { POST } = await import('@/app/api/mfa/route');
    const factorId = '20000000-0000-4000-8000-000000000002';
    const sessionUserId = '10000000-0000-4000-8000-000000000001';
    const response = await POST(
      new Request('https://licitatiero.ro/api/mfa', {
        method: 'POST',
        headers: {
          origin: 'https://licitatiero.ro',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ action: 'unenroll', factorId }),
      }),
    );
    expect(response.status).toBe(200);
    expect(unenrollMfaFactor).toHaveBeenCalledWith(
      expect.anything(),
      factorId,
      { aal: 'aal2', isStaff: true },
    );
    expect(recordMfaFactorUnenrolledAudit).toHaveBeenCalledWith(
      sessionUserId,
      factorId,
    );
  });

  it('does not record audit when unenroll fails', async () => {
    const { RequestError } = await import('@/lib/security');
    unenrollMfaFactor.mockRejectedValue(
      new RequestError('Unable to remove authenticator.'),
    );
    const { POST } = await import('@/app/api/mfa/route');
    const response = await POST(
      new Request('https://licitatiero.ro/api/mfa', {
        method: 'POST',
        headers: {
          origin: 'https://licitatiero.ro',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'unenroll',
          factorId: '20000000-0000-4000-8000-000000000002',
        }),
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(recordMfaFactorUnenrolledAudit).not.toHaveBeenCalled();
  });

  it('returns success with message when session refresh fails', async () => {
    unenrollMfaFactor.mockResolvedValue({ sessionRefreshFailed: true });
    recordMfaFactorUnenrolledAudit.mockResolvedValue(undefined);
    const { POST } = await import('@/app/api/mfa/route');
    const response = await POST(
      new Request('https://licitatiero.ro/api/mfa', {
        method: 'POST',
        headers: {
          origin: 'https://licitatiero.ro',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'unenroll',
          factorId: '20000000-0000-4000-8000-000000000002',
        }),
      }),
    );
    const body = (await response.json()) as {
      data: { removed: boolean; sessionRefreshFailed: boolean; message?: string };
    };
    expect(response.status).toBe(200);
    expect(body.data.removed).toBe(true);
    expect(body.data.sessionRefreshFailed).toBe(true);
    expect(body.data.message).toContain('Sign in again');
  });
});
