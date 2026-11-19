import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RequestError } from '@/lib/security';
vi.mock('server-only', () => ({}));
const { requireUser, rpc } = vi.hoisted(() => ({ requireUser: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/server/auth', () => ({ requireUser }));
import { GET } from '@/app/api/auctions/[id]/sealed-offers/route';
const id = '37000000-0000-4000-8000-000000000001';
const offer = { id, bidder_display_name: 'Bidder', amount_minor: 12300, created_at: '2026-11-16T06:00:00Z' };
beforeEach(() => { requireUser.mockResolvedValue({ db: { rpc } }); });
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
const read = (auctionId = id) => GET(new Request(`http://localhost/api/auctions/${auctionId}/sealed-offers`), { params: Promise.resolve({ id: auctionId }) });

it('returns only validated authorized rows with no-store caching', async () => {
  rpc.mockResolvedValue({ data: [{ ...offer, email: 'not-returned@example.test' }], error: null });
  const response = await read();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ data: [offer] });
  expect(rpc).toHaveBeenCalledWith('get_sealed_offers', { p_auction_id: id });
});
it('requires authentication before querying offers', async () => {
  requireUser.mockRejectedValue(new RequestError('Sign in to continue.', 401));
  const response = await read();
  expect(response.status).toBe(401);
  expect((await response.json()).data).toBeUndefined();
  expect(rpc).not.toHaveBeenCalled();
});
it('preserves database403 and never creates zero placeholder offers', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Owner or staff MFA required' } });
  const response = await read();
  expect(response.status).toBe(403);
  expect((await response.json()).data).toBeUndefined();
});
it('rejects invalid IDs before the RPC', async () => {
  const response = await read('invalid');
  expect(response.status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('fails closed if an authorized RPC returns malformed rows', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  rpc.mockResolvedValue({ data: [{ ...offer, amount_minor: null }], error: null });
  const response = await read();
  expect(response.status).toBe(500);
  expect((await response.json()).data).toBeUndefined();
});
