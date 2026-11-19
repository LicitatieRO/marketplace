import { expect, it } from 'vitest';
import { buildAccountSignInUrl, safeReturnPath } from '@/lib/security';
it('returns signed-out users to their saved-search page after login', () => {
  expect(buildAccountSignInUrl('/saved-searches')).toBe('/account?mode=login&next=%2Fsaved-searches');
  expect(safeReturnPath('/saved-searches?transaction_type=rent')).toBe('/saved-searches?transaction_type=rent');
});
it('keeps external and API lookalikes outside the return allowlist', () => {
  expect(safeReturnPath('//evil.example/saved-searches')).toBe('/workspace');
  expect(safeReturnPath('/api/saved-searches')).toBe('/workspace');
  expect(safeReturnPath('/saved-searches-evil')).toBe('/workspace');
});
