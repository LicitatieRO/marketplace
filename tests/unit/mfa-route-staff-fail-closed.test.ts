import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const unenrollMfaFactor = vi.fn();
const resolveIsStaffForMfaUnenrollMock = vi.fn();

vi.mock('@/lib/server/mfa-unenroll', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/mfa-unenroll')>();
  return {
    ...actual,
    unenrollMfaFactor,
    recordMfaFactorUnenrolledAudit: vi.fn(),
    MFA_UNENROLL_SESSION_REFRESH: 'Sign in again.',
  };
});

vi.mock('@/lib/server/mfa-staff-guard', () => ({
  resolveIsStaffForMfaUnenroll: (...args: unknown[]) =>
    resolveIsStaffForMfaUnenrollMock(...args),
}));

vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({
    user: {
      id: '10000000-0000-4000-8000-000000000001',
      email_confirmed_at: new Date().toISOString(),
    },
    db: {
      auth: {
        getClaims: async () => ({
          data: { claims: { aal: 'aal2' } },
          error: null,
        }),
      },
      rpc: async (name: string) => {
        if (name === 'get_workspace') {
          return { data: null, error: { message: 'rpc down' } };
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
  resolveIsStaffForMfaUnenrollMock.mockReset();
});

describe('POST /api/mfa unenroll staff resolution', () => {
  it('passes workspace error into staff resolver (fail closed)', async () => {
    resolveIsStaffForMfaUnenrollMock.mockReturnValue(true);
    unenrollMfaFactor.mockResolvedValue({ sessionRefreshFailed: false });
    const { POST } = await import('@/app/api/mfa/route');
    await POST(
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
    expect(resolveIsStaffForMfaUnenrollMock).toHaveBeenCalledWith(null, {
      message: 'rpc down',
    });
    expect(unenrollMfaFactor).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({ isStaff: true }),
    );
  });
});
