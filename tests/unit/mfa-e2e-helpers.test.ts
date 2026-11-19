import { describe, expect, it } from 'vitest';
import { assertLocalMfaTargets, totpCode } from '../e2e/helpers/totp';

describe('disposable MFA test safeguards', () => {
  const local = ['http://localhost:3000', 'http://127.0.0.1:15431', 'postgresql://127.0.0.1:15432/postgres'] as const;

  it('accepts the documented isolated local stack', () => {
    expect(() => assertLocalMfaTargets(...local)).not.toThrow();
  });

  it.each([
    ['https://staging.example.test', local[1], local[2]],
    [local[0], 'https://project.supabase.co', local[2]],
    [local[0], local[1], 'postgresql://localhost.evil.test:15432/postgres'],
    [local[0], local[1], 'postgresql://localhost:5432/postgres'],
    [local[0], local[1], 'not-a-url'],
  ])('refuses nonlocal or unexpected targets without echoing credentials', (app, auth, database) => {
    expect(() => assertLocalMfaTargets(app, auth, database)).toThrow('MFA E2E requires the isolated loopback test stack.');
  });
});

describe('test-process TOTP', () => {
  // Public RFC 6238 test vector, never an enrollment seed.
  const vector = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  it('matches the RFC SHA1 vector truncated to six digits', () => {
    expect(totpCode(vector, 59_000)).toBe('287082');
    expect(totpCode(vector, 1_111_111_109_000)).toBe('081804');
  });
  it('rejects malformed base32 input', () => {
    expect(() => totpCode('invalid!')).toThrow('Invalid test TOTP seed.');
  });
});
