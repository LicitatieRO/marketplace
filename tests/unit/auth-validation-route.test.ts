import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/server/auth-rate-limit', () => ({
  peekAuthSignInRateLimit: vi.fn(),
  recordAuthSignInFailure: vi.fn(),
  enforceAuthHttpRateLimit: vi.fn(),
}));

vi.mock('@/lib/server/supabase', () => ({
  getSupabase: vi.fn(async () => ({
    auth: {
      signInWithPassword: vi.fn(),
    },
  })),
}));

vi.mock('@/lib/config', () => ({
  isConfigured: () => true,
}));

describe('POST /api/auth validation', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns an allowlisted message for an invalid signup email', async () => {
    const { POST } = await import('@/app/api/auth/route');
    const response = await POST(
      new Request('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify({
          action: 'signup',
          email: 'not-an-email',
          password: 'secure-password-12',
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Enter a valid email address.' });
  });
});
