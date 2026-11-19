import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/server/mfa-verify-rate-limit', () => ({
  MFA_VERIFY_DENIED: 'Invalid or expired authenticator code.',
  MFA_VERIFY_UNAVAILABLE:
    'Authenticator verification is temporarily unavailable.',
  mfaVerifyReserveAttempt: vi.fn(async () => 'unavailable'),
  mfaVerifyResetOnSuccess: vi.fn(),
}));

vi.mock('@/lib/server/client-ip', () => ({
  clientIpForMfaRateLimit: () => '203.0.113.9',
  warnMfaVerifyMissingClientIp: () => {},
}));

const challengeAndVerify = vi.fn();

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

describe('POST /api/mfa verify unavailable limiter', () => {
  it('returns 503 without calling Supabase verify when service credentials are missing', async () => {
    const { POST } = await import('@/app/api/mfa/route');
    const response = await POST(
      new Request('https://licitatiero.ro/api/mfa', {
        method: 'POST',
        headers: {
          origin: 'https://licitatiero.ro',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verify',
          factorId: '20000000-0000-4000-8000-000000000002',
          code: '123456',
        }),
      }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Authenticator verification is temporarily unavailable.');
    expect(challengeAndVerify).not.toHaveBeenCalled();
  });
});
