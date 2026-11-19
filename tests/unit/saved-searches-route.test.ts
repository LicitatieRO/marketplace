import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { requireUser, rpc } = vi.hoisted(() => ({ requireUser: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/server/auth', () => ({ requireUser }));
vi.mock('@/lib/security', async (original) => ({ ...await original<typeof import('@/lib/security')>(), requestOrigin: () => 'http://localhost:3000' }));
import { GET, POST, DELETE } from '@/app/api/saved-searches/route';
import { RequestError } from '@/lib/security';
const row = { id: '41000000-0000-4000-8000-000000000001', name: 'My home', filters: {}, created_at: '2026-11-16T06:00:00Z', last_notified_at: null };
beforeEach(() => requireUser.mockResolvedValue({ db: { rpc } }));
afterEach(() => vi.resetAllMocks());
const request = (method: string, body: unknown, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/saved-searches', { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

it('reads only validated saved-search fields with no-store caching', async () => {
  rpc.mockResolvedValue({ data: [{ ...row, user_id: 'not-returned' }], error: null });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ data: [row] });
});
it('saves validated filters through the authenticated owner RPC', async () => {
  rpc.mockResolvedValue({ data: row, error: null });
  const response = await POST(request('POST', { name: 'My home', filters: {} }));
  expect(response.status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('save_saved_search', { p_name: 'My home', p_filters: {} });
});
it('rejects caller ownership and private filters before DB access', async () => {
  expect((await POST(request('POST', { name: 'Test', filters: { exact_address: 'private' }, user_id: 'other' }))).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
});
it('blocks cross-origin save and deletion', async () => {
  expect((await POST(request('POST', { name: 'Test', filters: {} }, 'https://evil.example'))).status).toBe(403);
  expect((await DELETE(request('DELETE', { id: row.id }, 'https://evil.example'))).status).toBe(403);
  expect(rpc).not.toHaveBeenCalled();
});
it('requires authentication', async () => {
  requireUser.mockRejectedValue(new RequestError('Sign in to continue.', 401));
  expect((await GET()).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it('keeps foreign or repeated deletion a safe false result', async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  const response = await DELETE(request('DELETE', { id: row.id }));
  expect(await response.json()).toEqual({ data: { deleted: false } });
  expect(rpc).toHaveBeenCalledWith('delete_saved_search', { p_id: row.id });
});
it.each(['Saved search capacity reached', 'Saved search limit reached'])('reports the exact fixed safe limit message: %s', async (message) => {
  rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message } });
  const response = await POST(request('POST', { name: 'Test', filters: {} }));
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: message });
});
