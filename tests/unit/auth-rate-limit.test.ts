import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rpc = vi.fn();

vi.mock('@/lib/server/notifications-db', () => ({
  isServiceRoleConfigured: () => true,
}));

vi.mock('@/lib/server/service-role', () => ({
  serviceRoleClient: () => ({ rpc }),
}));

describe('auth HTTP rate limit', () => {
  afterEach(() => {
    rpc.mockReset();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('returns 429 with Retry-After when the limiter denies', async () => {
    rpc.mockResolvedValue({
      data: { allowed: false, retry_after_seconds: 42 },
      error: null,
    });
    const { enforceAuthHttpRateLimit, AUTH_RATE_LIMIT_MESSAGE } = await import(
      '@/lib/server/auth-rate-limit'
    );
    const response = await enforceAuthHttpRateLimit(
      new Headers({ 'x-forwarded-for': '203.0.113.1' }),
      'signIn',
      'user@example.test',
    );
    expect(response).not.toBeNull();
    expect(response!.status).toBe(429);
    expect(response!.headers.get('Retry-After')).toBe('42');
    const body = await response!.json();
    expect(body).toEqual({ error: AUTH_RATE_LIMIT_MESSAGE });
  });

  it('fail-opens sign-in when the RPC is unavailable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const { enforceAuthHttpRateLimit } = await import('@/lib/server/auth-rate-limit');
    const response = await enforceAuthHttpRateLimit(
      new Headers({ 'x-forwarded-for': '203.0.113.2' }),
      'signIn',
      'user@example.test',
    );
    expect(response).toBeNull();
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('SIGN_IN_FAIL_OPEN'))).toBe(
      true,
    );
    errorSpy.mockRestore();
  });

  it('fail-closes recover when the RPC is unavailable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
    const { enforceAuthHttpRateLimit } = await import('@/lib/server/auth-rate-limit');
    const response = await enforceAuthHttpRateLimit(
      new Headers({ 'x-forwarded-for': '203.0.113.3' }),
      'recover',
      'user@example.test',
    );
    expect(response?.status).toBe(503);
    expect(errorSpy.mock.calls.some((c) => String(c[0]).includes('FAIL_CLOSED'))).toBe(true);
    errorSpy.mockRestore();
  });

  it('fail-closes sign-up when client IP is unknown', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { enforceAuthHttpRateLimit, AUTH_RATE_LIMIT_UNAVAILABLE_MESSAGE } = await import(
      '@/lib/server/auth-rate-limit'
    );
    const response = await enforceAuthHttpRateLimit(new Headers(), 'signUp', 'user@example.test');
    expect(response?.status).toBe(503);
    const body = await response!.json();
    expect(body).toEqual({ error: AUTH_RATE_LIMIT_UNAVAILABLE_MESSAGE });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('fail-closes DSA notice submit when client IP is unknown', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { enforceAuthHttpRateLimit, AUTH_RATE_LIMIT_UNAVAILABLE_MESSAGE } = await import(
      '@/lib/server/auth-rate-limit'
    );
    const response = await enforceAuthHttpRateLimit(new Headers(), 'dsaNotice');
    expect(response?.status).toBe(503);
    const body = await response!.json();
    expect(body).toEqual({ error: AUTH_RATE_LIMIT_UNAVAILABLE_MESSAGE });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('proceeds with sign-in when client IP is unknown but identifier is present', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    const { enforceAuthHttpRateLimit } = await import('@/lib/server/auth-rate-limit');
    const response = await enforceAuthHttpRateLimit(
      new Headers(),
      'signIn',
      'user@example.test',
    );
    expect(response).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[1]?.p_key_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('limits dsaNotice on the N+1 call with stable Vercel headers', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    let call = 0;
    rpc.mockImplementation(async () => {
      call += 1;
      if (call >= 6) {
        return { data: { allowed: false, retry_after_seconds: 120 }, error: null };
      }
      return { data: { allowed: true }, error: null };
    });
    const { enforceAuthHttpRateLimit, authRateLimitKeyHash } = await import(
      '@/lib/server/auth-rate-limit'
    );
    const headers = new Headers({
      'x-real-ip': '203.0.113.50',
      'x-forwarded-for': '203.0.113.50, 10.0.0.1',
    });
    for (let i = 0; i < 5; i += 1) {
      const allowed = await enforceAuthHttpRateLimit(headers, 'dsaNotice');
      expect(allowed).toBeNull();
    }
    const blocked = await enforceAuthHttpRateLimit(headers, 'dsaNotice');
    expect(blocked?.status).toBe(429);
    const hashes = rpc.mock.calls.map((entry) => entry[1]?.p_key_hash);
    expect(new Set(hashes).size).toBe(1);
    expect(hashes[0]).toBe(authRateLimitKeyHash('dsaNotice', 'ip', '203.0.113.50'));
  });

  it('limits signUp on the N+1 call with stable Vercel headers', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    let call = 0;
    rpc.mockImplementation(async () => {
      call += 1;
      if (call >= 6) {
        return { data: { allowed: false, retry_after_seconds: 60 }, error: null };
      }
      return { data: { allowed: true }, error: null };
    });
    const { enforceAuthHttpRateLimit } = await import('@/lib/server/auth-rate-limit');
    const headers = new Headers({ 'x-real-ip': '203.0.113.51' });
    for (let i = 0; i < 5; i += 1) {
      expect(await enforceAuthHttpRateLimit(headers, 'signUp', 'user@example.test')).toBeNull();
    }
    const blocked = await enforceAuthHttpRateLimit(headers, 'signUp', 'user@example.test');
    expect(blocked?.status).toBe(429);
    expect(rpc).toHaveBeenCalledTimes(6);
  });

  it('ignores x-vercel-forwarded-for and other Vercel hop headers for the IP bucket', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    const { enforceAuthHttpRateLimit, authRateLimitKeyHash } = await import(
      '@/lib/server/auth-rate-limit'
    );
    const stable = new Headers({
      'x-real-ip': '203.0.113.60',
      'x-forwarded-for': '203.0.113.60, 10.0.0.2',
    });
    const noisy = new Headers({
      'x-real-ip': '203.0.113.60',
      'x-forwarded-for': '203.0.113.60, 10.0.0.2',
      'x-vercel-forwarded-for': '198.51.100.99',
      'x-vercel-proxied-for': '127.0.0.1',
    });
    await enforceAuthHttpRateLimit(stable, 'dsaNotice');
    const stableHash = rpc.mock.calls.at(-1)?.[1]?.p_key_hash;
    await enforceAuthHttpRateLimit(noisy, 'dsaNotice');
    const noisyHash = rpc.mock.calls.at(-1)?.[1]?.p_key_hash;
    expect(stableHash).toBe(noisyHash);
    expect(stableHash).toBe(authRateLimitKeyHash('dsaNotice', 'ip', '203.0.113.60'));
  });

  it('fail-closes IP-only actions when Vercel headers contain only garbage', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    const { enforceAuthHttpRateLimit, AUTH_RATE_LIMIT_UNAVAILABLE_MESSAGE } = await import(
      '@/lib/server/auth-rate-limit'
    );
    const headers = new Headers({
      'x-real-ip': '%%%',
      'x-forwarded-for': 'not-valid, 203.0.113.9',
    });
    const dsa = await enforceAuthHttpRateLimit(headers, 'dsaNotice');
    expect(dsa?.status).toBe(503);
    expect(await dsa!.json()).toEqual({ error: AUTH_RATE_LIMIT_UNAVAILABLE_MESSAGE });
    const signUp = await enforceAuthHttpRateLimit(headers, 'signUp', 'user@example.test');
    expect(signUp?.status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('hashes ip and identifier buckets separately', async () => {
    rpc.mockResolvedValue({ data: { allowed: true }, error: null });
    const { enforceAuthHttpRateLimit, authRateLimitKeyHash } = await import(
      '@/lib/server/auth-rate-limit'
    );
    const ipHash = authRateLimitKeyHash('signIn', 'ip', '203.0.113.5');
    const idHash = authRateLimitKeyHash('signIn', 'identifier', 'User@Example.test');
    expect(ipHash).not.toBe(idHash);
    await enforceAuthHttpRateLimit(
      new Headers({ 'x-forwarded-for': '203.0.113.5' }),
      'signIn',
      'User@Example.test',
    );
    const hashes = rpc.mock.calls.map((call) => call[1]?.p_key_hash);
    expect(hashes).toContain(ipHash);
    expect(hashes).toContain(idHash);
  });
});
