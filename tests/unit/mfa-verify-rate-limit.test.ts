import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type RpcPayload = {
  p_user_id: string;
  p_factor_id: string;
  p_client_ip: string;
  p_operation: string;
};

const rpcCalls: RpcPayload[] = [];
let attemptCount = 0;

vi.mock('@/lib/config', () => ({
  supabaseConfig: () => ({ url: 'http://127.0.0.1:54321', key: 'service' }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (_name: string, params: RpcPayload) => {
      rpcCalls.push(params);
      if (params.p_operation === 'attempt') {
        if (attemptCount >= 5) {
          return Promise.resolve({ data: { allowed: false }, error: null });
        }
        attemptCount += 1;
        return Promise.resolve({ data: { allowed: true }, error: null });
      }
      if (params.p_operation === 'reset') {
        attemptCount = 0;
        return Promise.resolve({ data: { allowed: true }, error: null });
      }
      return Promise.resolve({ data: { allowed: true }, error: null });
    },
  }),
}));

const baseEnv = { ...process.env };

beforeEach(() => {
  process.env.SUPABASE_SECRET_KEY = 'test-service-key';
});

afterEach(() => {
  process.env = { ...baseEnv };
  rpcCalls.length = 0;
  attemptCount = 0;
  vi.resetModules();
});

describe('mfa verify rate limit helpers', () => {
  it('reserves attempts via attempt RPC using auth user id', async () => {
    const { mfaVerifyReserveAttempt } = await import('@/lib/server/mfa-verify-rate-limit');
    const uid = '10000000-0000-4000-8000-000000000001';
    const fid = '20000000-0000-4000-8000-000000000002';
    await expect(mfaVerifyReserveAttempt(uid, fid, '203.0.113.1')).resolves.toBe('allowed');
    for (let i = 0; i < 4; i += 1) {
      await expect(mfaVerifyReserveAttempt(uid, fid, '203.0.113.1')).resolves.toBe('allowed');
    }
    await expect(mfaVerifyReserveAttempt(uid, fid, '203.0.113.1')).resolves.toBe('denied');
    expect(rpcCalls.every((c) => c.p_operation === 'attempt')).toBe(true);
    expect(rpcCalls[0]?.p_user_id).toBe(uid);
  });

  it('does not fail closed when client IP is unparseable (RPC still allowed)', async () => {
    const { mfaVerifyReserveAttempt } = await import('@/lib/server/mfa-verify-rate-limit');
    await expect(
      mfaVerifyReserveAttempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        'not-a-valid-ip',
      ),
    ).resolves.toBe('allowed');
    expect(rpcCalls.at(-1)?.p_client_ip).toBe('not-a-valid-ip');
  });

  it('still applies factor limit when client IP is absent', async () => {
    const { mfaVerifyReserveAttempt } = await import('@/lib/server/mfa-verify-rate-limit');
    await expect(
      mfaVerifyReserveAttempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        null,
      ),
    ).resolves.toBe('allowed');
    expect(rpcCalls.at(-1)?.p_client_ip).toBe('');
  });

  it('fails closed when SUPABASE_SECRET_KEY is missing', async () => {
    delete process.env.SUPABASE_SECRET_KEY;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { mfaVerifyReserveAttempt } = await import('@/lib/server/mfa-verify-rate-limit');
    await expect(
      mfaVerifyReserveAttempt(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
        '203.0.113.1',
      ),
    ).resolves.toBe('unavailable');
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith(
      'MFA verify rate limit unavailable: SUPABASE_SECRET_KEY is not configured.',
    );
    errorSpy.mockRestore();
  });
});
