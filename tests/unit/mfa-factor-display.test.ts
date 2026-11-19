import { describe, expect, it } from 'vitest';
import {
  mfaFactorDisplayLabel,
  mfaUnenrollPostBody,
} from '@/lib/mfa-factor-display';

describe('mfa factor display', () => {
  const first = '10000000-0000-4000-8000-000000000001';
  const second = '20000000-0000-4000-8000-000000000002';

  it('uses friendly name when present', () => {
    expect(
      mfaFactorDisplayLabel({
        id: first,
        status: 'verified',
        friendly_name: 'Backup phone',
      }),
    ).toBe('Backup phone');
  });

  it('falls back to type and short id', () => {
    expect(
      mfaFactorDisplayLabel({
        id: second,
        status: 'verified',
        factor_type: 'totp',
      }),
    ).toBe('totp · 20000000');
  });

  it('sends the explicitly selected factor id, not the first listed', () => {
    expect(mfaUnenrollPostBody(second)).toEqual({
      action: 'unenroll',
      factorId: second,
    });
    expect(mfaUnenrollPostBody(second).factorId).not.toBe(first);
  });
});
