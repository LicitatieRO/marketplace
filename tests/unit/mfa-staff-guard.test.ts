import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveIsStaffForMfaUnenroll } from '@/lib/server/mfa-staff-guard';

describe('resolveIsStaffForMfaUnenroll', () => {
  it('treats missing workspace profile as staff (fail closed)', () => {
    expect(resolveIsStaffForMfaUnenroll(null, null)).toBe(true);
    expect(resolveIsStaffForMfaUnenroll({}, null)).toBe(true);
  });

  it('treats workspace RPC errors as staff (fail closed)', () => {
    expect(
      resolveIsStaffForMfaUnenroll(undefined, { message: 'rpc failed' }),
    ).toBe(true);
  });

  it('reads is_staff when workspace profile is present', () => {
    expect(
      resolveIsStaffForMfaUnenroll({ profile: { is_staff: true } }, null),
    ).toBe(true);
    expect(
      resolveIsStaffForMfaUnenroll({ profile: { is_staff: false } }, null),
    ).toBe(false);
  });
});
