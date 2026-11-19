import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const listFactors = vi.fn();
const unenroll = vi.fn();
const refreshSession = vi.fn();

function mockDb() {
  return {
    auth: {
      mfa: { listFactors, unenroll },
      refreshSession,
    },
  };
}

import {
  MFA_UNENROLL_AAL,
  MFA_UNENROLL_BLOCKED,
  MFA_UNENROLL_GENERIC,
  unenrollMfaFactor,
} from '@/lib/server/mfa-unenroll';

afterEach(() => {
  listFactors.mockReset();
  unenroll.mockReset();
  refreshSession.mockReset();
});

describe('unenrollMfaFactor', () => {
  const ownFactor = '20000000-0000-4000-8000-000000000002';
  const otherFactor = '30000000-0000-4000-8000-000000000003';

  it('rejects a factor id that is not in the session factor list', async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: ownFactor, status: 'verified' }] },
      error: null,
    });
    await expect(
      unenrollMfaFactor(mockDb() as never, otherFactor, {
        aal: 'aal2',
        isStaff: false,
      }),
    ).rejects.toMatchObject({ message: MFA_UNENROLL_GENERIC });
    expect(unenroll).not.toHaveBeenCalled();
  });

  it('denies removing a verified factor when the session is aal1', async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: ownFactor, status: 'verified' }] },
      error: null,
    });
    await expect(
      unenrollMfaFactor(mockDb() as never, ownFactor, {
        aal: 'aal1',
        isStaff: false,
      }),
    ).rejects.toMatchObject({ message: MFA_UNENROLL_AAL, status: 403 });
    expect(unenroll).not.toHaveBeenCalled();
  });

  it('denies staff removing their last verified factor', async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: ownFactor, status: 'verified' }] },
      error: null,
    });
    await expect(
      unenrollMfaFactor(mockDb() as never, ownFactor, {
        aal: 'aal2',
        isStaff: true,
      }),
    ).rejects.toMatchObject({ message: MFA_UNENROLL_BLOCKED, status: 403 });
    expect(unenroll).not.toHaveBeenCalled();
  });

  it('allows a non-staff user to remove their last verified factor at aal2', async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: ownFactor, status: 'verified' }] },
      error: null,
    });
    unenroll.mockResolvedValue({ error: null });
    refreshSession.mockResolvedValue({ error: null });
    const result = await unenrollMfaFactor(mockDb() as never, ownFactor, {
      aal: 'aal2',
      isStaff: false,
    });
    expect(unenroll).toHaveBeenCalledWith({ factorId: ownFactor });
    expect(refreshSession).toHaveBeenCalled();
    expect(result.sessionRefreshFailed).toBe(false);
  });

  it('returns success when refreshSession fails after unenroll', async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: ownFactor, status: 'verified' }] },
      error: null,
    });
    unenroll.mockResolvedValue({ error: null });
    refreshSession.mockResolvedValue({ error: { message: 'stale' } });
    const result = await unenrollMfaFactor(mockDb() as never, ownFactor, {
      aal: 'aal2',
      isStaff: false,
    });
    expect(result.sessionRefreshFailed).toBe(true);
  });

  it('allows removing an unverified factor at aal1', async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: ownFactor, status: 'unverified' }] },
      error: null,
    });
    unenroll.mockResolvedValue({ error: null });
    refreshSession.mockResolvedValue({ error: null });
    await unenrollMfaFactor(mockDb() as never, ownFactor, {
      aal: 'aal1',
      isStaff: false,
    });
    expect(unenroll).toHaveBeenCalledWith({ factorId: ownFactor });
  });
});

describe('staff guard fail-closed via isStaff flag', () => {
  const ownFactor = '20000000-0000-4000-8000-000000000002';

  it('blocks last verified factor when isStaff is true from fail-closed resolution', async () => {
    listFactors.mockResolvedValue({
      data: { totp: [{ id: ownFactor, status: 'verified' }] },
      error: null,
    });
    await expect(
      unenrollMfaFactor(mockDb() as never, ownFactor, {
        aal: 'aal2',
        isStaff: true,
      }),
    ).rejects.toMatchObject({ message: MFA_UNENROLL_BLOCKED, status: 403 });
  });
});
