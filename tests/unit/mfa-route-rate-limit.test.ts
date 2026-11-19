import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const challengeAndVerify = vi.fn(async () => ({ data: { id: 'ok' }, error: null }));
let reservedAttempts = 0;

vi.mock('@/lib/server/mfa-verify-rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/mfa-verify-rate-limit')>();
  return {
    ...actual,
    mfaVerifyReserveAttempt: vi.fn(async () => {
      if (reservedAttempts >= 5) return 'denied';
      reservedAttempts += 1;
      return 'allowed';
    }),
    mfaVerifyResetOnSuccess: vi.fn(async () => {
      reservedAttempts = 0;
    }),
  };
});

vi.mock('@/lib/server/client-ip', () => ({
  clientIpForMfaRateLimit: () => '203.0.113.9',
  warnMfaVerifyMissingClientIp: () => {},
}));

vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({
    user: { id: '10000000-0000-4000-8000-000000000001', email_confirmed_at: new Date().toISOString() },
    db: {
      auth: {
        mfa: {
          challengeAndVerify,
        },
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
  reservedAttempts = 0;
  challengeAndVerify.mockClear();
  vi.resetModules();
});

function verifyRequest() {
  return new Request('https://licitatiero.ro/api/mfa', {
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
  });
}

describe('POST /api/mfa verify rate limit', () => {
  it('rejects verify when the limiter denies before challengeAndVerify', async () => {
    reservedAttempts = 5;
    const { POST } = await import('@/app/api/mfa/route');
    const response = await POST(verifyRequest());
    expect(response.status).toBe(403);
    expect(challengeAndVerify).not.toHaveBeenCalled();
  });

  it('limits concurrent verify calls to at most five Supabase challenges', async () => {
    const { POST } = await import('@/app/api/mfa/route');
    const responses = await Promise.all(Array.from({ length: 10 }, () => POST(verifyRequest())));
    const verifyCalls = challengeAndVerify.mock.calls.length;
    expect(verifyCalls).toBeLessThanOrEqual(5);
    expect(responses.filter((r) => r.status === 200).length).toBeLessThanOrEqual(5);
    expect(responses.filter((r) => r.status === 403).length).toBeGreaterThanOrEqual(5);
  });

});
