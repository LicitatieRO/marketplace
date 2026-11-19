import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const peekAuthSignInRateLimit = vi.fn();

vi.mock('@/lib/server/auth-rate-limit', () => ({
  peekAuthSignInRateLimit,
  recordAuthSignInFailure: vi.fn(),
  enforceAuthHttpRateLimit: vi.fn(),
  AUTH_RATE_LIMIT_MESSAGE: 'Too many attempts. Please try again later.',
}));

vi.mock('@/lib/server/supabase', () => ({
  getSupabase: vi.fn(async () => ({
    auth: {
      signUp: vi.fn(),
      signOut: vi.fn(),
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  })),
}));

vi.mock('@/lib/config', () => ({
  isConfigured: () => true,
  supabaseConfig: () => ({
    url: 'http://127.0.0.1:54321',
    key: 'test-anon',
  }),
}));

describe('POST /api/auth rate limit', () => {
  afterEach(() => {
    peekAuthSignInRateLimit.mockReset();
    vi.resetModules();
  });

  it('returns the limiter response for login without calling signInWithPassword', async () => {
    peekAuthSignInRateLimit.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Too many attempts. Please try again later.' }), {
        status: 429,
        headers: { 'Retry-After': '60' },
      }),
    );
    const { POST } = await import('@/app/api/auth/route');
    const { getSupabase } = await import('@/lib/server/supabase');
    const response = await POST(
      new Request('http://localhost:3000/api/auth', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3000',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'login',
          email: 'user@example.test',
          password: 'secure-password-12',
        }),
      }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    const db = await getSupabase();
    expect(db.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
