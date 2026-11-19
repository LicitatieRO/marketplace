import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { enroll } = vi.hoisted(() => ({ enroll: vi.fn() }));
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({ user: { id: 'test-user' }, db: { auth: { mfa: { enroll } } } }),
}));
afterEach(() => enroll.mockReset());

it('allows a backup authenticator without an Auth friendly-name conflict', async () => {
  const names = new Set<string>();
  // Real GoTrue rejects duplicate friendly names for a user, including verified factors.
  enroll.mockImplementation(async ({ friendlyName, factorType }) => {
    expect(factorType).toBe('totp');
    if (names.has(friendlyName)) return { data: null, error: { code: 'mfa_factor_name_conflict' } };
    names.add(friendlyName);
    return { data: { id: 'test-factor' }, error: null };
  });
  const { POST } = await import('@/app/api/mfa/route');
  for (let index = 0; index < 2; index++) {
    const response = await POST(new Request('https://licitatiero.ro/api/mfa', {
      method: 'POST', headers: { origin: 'https://licitatiero.ro', 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'enroll' }),
    }));
    expect(response.status).toBe(200);
  }
  expect(names.size).toBe(2);
});
