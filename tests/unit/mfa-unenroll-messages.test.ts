import { describe, expect, it } from 'vitest';
import {
  MFA_UNENROLL_STAFF_LAST_FACTOR_CODE,
  mfaUnenrollApiErrorMessage,
} from '@/lib/mfa-unenroll-messages';

describe('mfaUnenrollApiErrorMessage', () => {
  const t = (ro: string, en: string) => `${ro}|${en}`;

  it('returns bilingual staff last-factor copy when the API error code matches', () => {
    const message = mfaUnenrollApiErrorMessage(
      {
        error: 'This change is unavailable. Refresh and try again.',
        code: MFA_UNENROLL_STAFF_LAST_FACTOR_CODE,
      },
      t,
      'fallback',
    );
    expect(message).toContain('staff');
    expect(message).toContain('Contururile staff');
    expect(message).not.toBe('This change is unavailable. Refresh and try again.');
  });

  it('returns the API error string for other codes', () => {
    expect(
      mfaUnenrollApiErrorMessage(
        { error: 'Verify your session before removing an authenticator.' },
        t,
        'fallback',
      ),
    ).toBe('Verify your session before removing an authenticator.');
  });

  it('returns fallback when error is missing', () => {
    expect(mfaUnenrollApiErrorMessage({}, t, 'fallback')).toBe('fallback');
  });
});
