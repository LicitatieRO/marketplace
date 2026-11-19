import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  reserveAttempt.mockClear();
});

vi.mock('server-only', () => ({}));

const reserveAttempt = vi.fn(
  async (_userId: string, _factorId: string, _clientIp: string | null) =>
    'allowed' as const,
);
const challengeAndVerify = vi.fn(async () => ({ data: { id: 'ok' }, error: null }));

vi.mock('@/lib/server/mfa-verify-rate-limit', () => ({
  MFA_VERIFY_DENIED: 'Invalid or expired authenticator code.',
  MFA_VERIFY_UNAVAILABLE:
    'Authenticator verification is temporarily unavailable.',
  mfaVerifyReserveAttempt: reserveAttempt,
  mfaVerifyResetOnSuccess: vi.fn(),
}));

vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({
    user: { id: '10000000-0000-4000-8000-000000000001', email_confirmed_at: new Date().toISOString() },
    db: {
      auth: {
        mfa: { challengeAndVerify },
      },
    },
  }),
}));

vi.mock('@/lib/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/security')>();
  return { ...actual, requestOrigin: () => 'https://licitatiero.ro' };
});

describe('POST /api/mfa verify unparseable client IP', () => {
  it('reserves factor limit only (null IP) without HTTP 503', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    const { POST } = await import('@/app/api/mfa/route');
    const response = await POST(
      new Request('https://licitatiero.ro/api/mfa', {
        method: 'POST',
        headers: {
          origin: 'https://licitatiero.ro',
          'content-type': 'application/json',
          'x-real-ip': '%%%invalid%%%',
        },
        body: JSON.stringify({
          action: 'verify',
          factorId: '20000000-0000-4000-8000-000000000002',
          code: '123456',
        }),
      }),
    );
    expect(response.status).not.toBe(503);
    expect(reserveAttempt).toHaveBeenCalledWith(
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      null,
    );
  });
});
