import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  vi.unstubAllEnvs();
});

describe('trustedClientIp', () => {
  it('prefers x-real-ip on Vercel', async () => {
    vi.resetModules();
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    const { trustedClientIp } = await import('@/lib/server/client-ip');
    expect(
      trustedClientIp(
        new Headers({
          'x-real-ip': '203.0.113.8',
          'x-forwarded-for': '198.51.100.1, 10.0.0.1',
        }),
      ),
    ).toBe('203.0.113.8');
  });

  it('falls back to the first forwarded hop on Vercel when x-real-ip is absent', async () => {
    vi.resetModules();
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    const { trustedClientIp } = await import('@/lib/server/client-ip');
    expect(
      trustedClientIp(
        new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }),
      ),
    ).toBe('203.0.113.7');
  });

  it('returns null on Vercel when no proxy IP headers exist', async () => {
    vi.resetModules();
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    const { trustedClientIp } = await import('@/lib/server/client-ip');
    expect(trustedClientIp(new Headers())).toBeNull();
  });

  it('falls back to loopback in local development', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.VERCEL;
    const { trustedClientIp } = await import('@/lib/server/client-ip');
    expect(trustedClientIp(new Headers())).toBe('127.0.0.1');
  });

  it('never uses the right-most x-forwarded-for hop on Vercel', async () => {
    vi.resetModules();
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    const { trustedClientIp } = await import('@/lib/server/client-ip');
    expect(
      trustedClientIp(new Headers({ 'x-forwarded-for': 'not-an-ip, 203.0.113.44' })),
    ).toBeNull();
    expect(
      trustedClientIp(
        new Headers({
          'x-forwarded-for': '203.0.113.44, 198.51.100.2',
        }),
      ),
    ).toBe('203.0.113.44');
  });
});

describe('rateLimitIpKeyMaterial', () => {
  it('maps IPv6 variants in the same /64 to one stable key', async () => {
    vi.resetModules();
    const { rateLimitIpKeyMaterial } = await import('@/lib/server/client-ip');
    const { authRateLimitKeyHash } = await import('@/lib/server/auth-rate-limit');
    const variants = [
      '2001:0db8:85a3:0000:8a2e:0370:7334:0000',
      '2001:db8:85a3::7334',
      '2001:db8:85a3:0:8a2e:0370:7334:0000',
    ];
    const keys = new Set(variants.map((ip) => rateLimitIpKeyMaterial(ip)));
    expect(keys.size).toBe(1);
    expect(keys.values().next().value).toBe('2001:0db8:85a3:0000::/64');
    const hashes = variants.map((ip) => authRateLimitKeyHash('dsaNotice', 'ip', ip));
    expect(new Set(hashes).size).toBe(1);
  });

  it('leaves IPv4 addresses unchanged', async () => {
    vi.resetModules();
    const { rateLimitIpKeyMaterial } = await import('@/lib/server/client-ip');
    expect(rateLimitIpKeyMaterial('203.0.113.9')).toBe('203.0.113.9');
  });

  it('stabilizes rotating IPv6 privacy addresses within the same /64', async () => {
    vi.resetModules();
    const { rateLimitIpKeyMaterial } = await import('@/lib/server/client-ip');
    const { authRateLimitKeyHash } = await import('@/lib/server/auth-rate-limit');
    const rotating = [
      '2001:db8:85a3:0:8a2e:1111:2222:3333',
      '2001:db8:85a3:0:8a2e:4444:5555:6666',
    ];
    const rawKeys = new Set(rotating);
    expect(rawKeys.size).toBe(2);
    const limitKeys = new Set(rotating.map((ip) => rateLimitIpKeyMaterial(ip)));
    expect(limitKeys.size).toBe(1);
    const hashes = rotating.map((ip) => authRateLimitKeyHash('signUp', 'ip', ip));
    expect(new Set(hashes).size).toBe(1);
  });
});

describe('normalizeClientIp', () => {
  it('maps IPv4-mapped IPv6 to the underlying IPv4 address', async () => {
    vi.resetModules();
    const { normalizeClientIp, rateLimitIpKeyMaterial } = await import('@/lib/server/client-ip');
    expect(normalizeClientIp('::ffff:203.0.113.44')).toBe('203.0.113.44');
    expect(rateLimitIpKeyMaterial('::ffff:203.0.113.44')).toBe('203.0.113.44');
  });

  it('strips IPv6 zone identifiers', async () => {
    vi.resetModules();
    const { normalizeClientIp } = await import('@/lib/server/client-ip');
    expect(normalizeClientIp('fe80::1%eth0')).toBe('fe80::1');
  });

  it('accepts bracketed IPv6 literals with a port', async () => {
    vi.resetModules();
    const { normalizeClientIp, clientIpForMfaRateLimit } = await import('@/lib/server/client-ip');
    expect(normalizeClientIp('[::1]:443')).toBe('::1');
    vi.stubEnv('VERCEL', '1');
    expect(
      clientIpForMfaRateLimit(new Headers({ 'x-real-ip': '[::1]:443' })),
    ).toBe('::1');
  });

  it('rejects IPv4 addresses with leading-zero octets', async () => {
    vi.resetModules();
    const { normalizeClientIp } = await import('@/lib/server/client-ip');
    expect(normalizeClientIp('001.002.003.004')).toBeNull();
    expect(normalizeClientIp('192.168.001.010')).toBeNull();
  });
});

describe('clientIpForMfaRateLimit', () => {
  it('returns null when the trusted hop is not a valid IP', async () => {
    vi.resetModules();
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('NODE_ENV', 'production');
    const { clientIpForMfaRateLimit } = await import('@/lib/server/client-ip');
    expect(
      clientIpForMfaRateLimit(
        new Headers({
          'x-real-ip': 'not-a-valid-ip',
        }),
      ),
    ).toBeNull();
  });

  it('passes through a valid IPv4 address', async () => {
    vi.resetModules();
    vi.stubEnv('VERCEL', '1');
    const { clientIpForMfaRateLimit } = await import('@/lib/server/client-ip');
    expect(
      clientIpForMfaRateLimit(new Headers({ 'x-real-ip': '203.0.113.4' })),
    ).toBe('203.0.113.4');
  });
});
