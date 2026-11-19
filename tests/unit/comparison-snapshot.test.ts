import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { getCatalogue } = vi.hoisted(() => ({ getCatalogue: vi.fn() }));
vi.mock('@/lib/server/catalogue', () => ({ getCatalogue }));
import { getPublicComparisonSnapshot } from '@/lib/server/comparison';
afterEach(() => vi.resetAllMocks());
it('returns a safe unavailable state without provider failure details', async () => {
  getCatalogue.mockRejectedValue(new Error('private-provider-marker'));
  const snapshot = await getPublicComparisonSnapshot();
  expect(snapshot.unavailable).toBe(true);
  expect(snapshot.options).toEqual([]);
  expect(Number.isFinite(Date.parse(snapshot.sampledAt))).toBe(true);
  expect(JSON.stringify(snapshot)).not.toContain('private-provider-marker');
});
