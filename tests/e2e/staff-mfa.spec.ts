import { randomBytes, randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { assertLocalMfaTargets, totpCode } from './helpers/totp';

test.skip(process.env.E2E_BACKEND !== '1', 'Requires the isolated local Supabase backend');
// Enrollment responses contain seeds/QR codes. Never capture network traces or images.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('staff MFA enrollment, fresh-session challenge, and safe backup-factor removal', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const appUrl = String(testInfo.project.use.baseURL);
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const databaseUrl = process.env.DATABASE_URL || '';
  assertLocalMfaTargets(appUrl, authUrl, databaseUrl);
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!serviceKey) throw new Error('Missing local MFA test setup credential.');
  const admin = createClient(authUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const sql = new pg.Client({ connectionString: databaseUrl });
  const email = `mfa-${randomUUID()}@example.test`;
  const password = randomBytes(24).toString('base64url');
  let userId: string | undefined;

  async function post(request: APIRequestContext, path: string, data: object) {
    return request.post(path, { headers: { Origin: appUrl }, data });
  }
  async function mfa(data: object) { return post(page.request, '/api/mfa', data); }
  async function enroll() {
    const response = await mfa({ action: 'enroll' });
    expect(response.status()).toBe(200);
    const body = await response.json();
    // Only assert booleans so failed assertions cannot print actual secrets.
    expect(typeof body.data?.id === 'string' && typeof body.data?.totp?.secret === 'string').toBe(true);
    return { id: body.data.id as string, secret: body.data.totp.secret as string };
  }
  async function verify(factor: { id: string; secret: string }) {
    const response = await mfa({ action: 'verify', factorId: factor.id, code: totpCode(factor.secret) });
    expect(response.status()).toBe(200);
    expect((await response.json()).data?.verified).toBe(true);
  }
  async function sessionAal() {
    const response = await page.request.get('/api/session');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data?.is_staff).toBe(true);
    return body.data?.aal;
  }

  try {
    await sql.connect();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Disposable local MFA account creation failed.');
    userId = created.data.user.id;
    // Guard above restricts this SQL to the documented disposable local CI database.
    const promoted = await sql.query('update app.profiles set is_staff = true where id = $1 returning id', [userId]);
    expect(promoted.rowCount).toBe(1);
    expect((await post(page.request, '/api/auth', { action: 'login', email, password })).status()).toBe(200);
    expect(await sessionAal()).toBe('aal1');
    expect((await page.goto('/founder/outbox'))?.status()).toBe(404);

    const primary = await enroll();
    await verify(primary);
    expect(await sessionAal()).toBe('aal2');
    expect((await page.goto('/founder/outbox'))?.status()).toBe(200);

    expect((await post(page.request, '/api/auth', { action: 'logout' })).status()).toBe(200);
    expect((await post(page.request, '/api/auth', { action: 'login', email, password })).status()).toBe(200);
    expect(await sessionAal()).toBe('aal1');
    expect((await page.goto('/founder/outbox'))?.status()).toBe(404);
    expect((await mfa({ action: 'unenroll', factorId: primary.id })).status()).toBe(403);

    const validCodes = [-30_000, 0, 30_000].map((delta) => totpCode(primary.secret, Date.now() + delta));
    const invalidCode = ['000000', '111111', '222222', '333333'].find((code) => !validCodes.includes(code))!;
    const invalid = await mfa({ action: 'verify', factorId: primary.id, code: invalidCode });
    expect(invalid.status()).toBe(403);
    expect((await invalid.json()).error).toBe('Invalid or expired authenticator code.');
    expect(await sessionAal()).toBe('aal1');

    // GoTrue rejects replay of the previous verified time step, even after logout.
    await new Promise((resolve) => setTimeout(resolve, 30_000 - Date.now() % 30_000 + 1_100));
    await verify(primary);
    expect(await sessionAal()).toBe('aal2');
    const backup = await enroll();
    await verify(backup);
    expect((await mfa({ action: 'unenroll', factorId: primary.id })).status()).toBe(200);
    const remaining = await mfa({ action: 'list' });
    expect(remaining.status()).toBe(200);
    const factors = (await remaining.json()).data.totp as { id: string; status: string }[];
    expect(factors.some((factor) => factor.id === primary.id)).toBe(false);
    expect(factors.some((factor) => factor.id === backup.id && factor.status === 'verified')).toBe(true);
    expect(await sessionAal()).toBe('aal2');
    // Staff cannot remove their final verified factor, including from an AAL2 session.
    expect((await mfa({ action: 'unenroll', factorId: backup.id })).status()).toBe(403);
  } finally {
    await page.context().clearCookies();
    if (userId) {
      const removed = await admin.auth.admin.deleteUser(userId);
      if (removed.error) throw new Error('Disposable local MFA account cleanup failed.');
    }
    await sql.end();
  }
});
