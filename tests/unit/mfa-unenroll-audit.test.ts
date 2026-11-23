import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const rpc = vi.fn();

vi.mock('@/lib/server/service-role', () => ({
  serviceRoleClient: () => ({ rpc }),
}));

describe('recordMfaFactorUnenrolledAudit', () => {
  afterEach(() => {
    rpc.mockReset();
    vi.restoreAllMocks();
  });

  it('calls the service_role audit RPC with session user and factor id', async () => {
    rpc.mockResolvedValue({ error: null });
    const { recordMfaFactorUnenrolledAudit } = await import(
      '@/lib/server/mfa-unenroll'
    );
    const userId = '10000000-0000-4000-8000-000000000001';
    const factorId = '20000000-0000-4000-8000-000000000002';
    await recordMfaFactorUnenrolledAudit(userId, factorId);
    expect(rpc).toHaveBeenCalledWith('audit_mfa_factor_unenrolled', {
      p_user_id: userId,
      p_factor_id: factorId,
    });
  });

  it('logs and does not throw when the audit RPC fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rpc.mockResolvedValue({ error: { message: 'rpc failed' } });
    const { recordMfaFactorUnenrolledAudit } = await import(
      '@/lib/server/mfa-unenroll'
    );
    await expect(
      recordMfaFactorUnenrolledAudit(
        '10000000-0000-4000-8000-000000000001',
        '20000000-0000-4000-8000-000000000002',
      ),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith('mfa.unenroll_audit_failed', {
      reason: 'audit_rpc_error',
    });
  });
});