import { afterEach, describe, expect, it } from 'vitest';
import { assertPublicHealthShape, healthSnapshot, healthStatusCode } from '@/lib/health';

const SECRET_ENV_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_MODE',
  'STRIPE_LIVEMODE',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'EMAIL_DELIVERY_MODE',
  'SUPABASE_SERVICE_ROLE_KEY',
  'POC_ACCOUNT_SWITCHER',
] as const;

const PUBLIC_MODE_KEYS = ['NEXT_PUBLIC_APP_MODE', 'APP_ENV'] as const;

function cleanEnv() {
  for (const key of [...SECRET_ENV_KEYS, ...PUBLIC_MODE_KEYS]) delete process.env[key];
}

function stableSnapshot(env: Record<string, string | undefined>) {
  return healthSnapshot({
    configured: true,
    databaseOk: true,
    requestId: 'fixed-request-id',
    env,
  });
}

function withoutRequestId(body: ReturnType<typeof healthSnapshot>) {
  return {
    status: body.status,
    database: body.database,
    liveDeposits: body.liveDeposits,
    poc: body.poc,
    ...(body.appMode === undefined ? {} : { appMode: body.appMode }),
  };
}

describe('health snapshot', () => {
  afterEach(() => {
    cleanEnv();
  });

  it('always marks the deployment as POC with live deposits disabled', () => {
    const body = healthSnapshot({
      configured: true,
      databaseOk: true,
      requestId: 'rid-1',
    });
    expect(body.liveDeposits).toBe(false);
    expect(body.poc).toBe(true);
    expect(body.requestId).toBe('rid-1');
    assertPublicHealthShape(body);
  });

  it('reflects unconfigured backend without inferring appMode from Supabase env', () => {
    const body = healthSnapshot({
      configured: false,
      databaseOk: false,
      requestId: 'rid-2',
    });
    expect(body).toMatchObject({
      status: 'unconfigured',
      database: false,
    });
    expect(body).not.toHaveProperty('appMode');
    expect(healthStatusCode(body)).toBe(503);
  });

  it('reports backend availability from the database probe only', () => {
    const ok = healthSnapshot({ configured: true, databaseOk: true, requestId: 'r' });
    const down = healthSnapshot({ configured: true, databaseOk: false, requestId: 'r' });
    expect(ok.status).toBe('ok');
    expect(healthStatusCode(ok)).toBe(200);
    expect(down.status).toBe('unavailable');
    expect(healthStatusCode(down)).toBe(503);
  });

  it('includes appMode only from explicit non-secret env vars', () => {
    const fromPublic = healthSnapshot({
      configured: true,
      databaseOk: true,
      requestId: 'r',
      env: { NEXT_PUBLIC_APP_MODE: 'staging' },
    });
    expect(fromPublic.appMode).toBe('staging');
    const fromAppEnv = healthSnapshot({
      configured: true,
      databaseOk: true,
      requestId: 'r',
      env: { APP_ENV: 'preview' },
    });
    expect(fromAppEnv.appMode).toBe('preview');
  });

  it('is byte-identical aside from requestId regardless of secret env presence', () => {
    const baseline = stableSnapshot({});
    const variants = [
      {},
      { STRIPE_SECRET_KEY: 'sk_test_example' },
      { STRIPE_SECRET_KEY: 'sk_live_example' },
      { RESEND_API_KEY: 're_example', EMAIL_FROM: 'from@example.test' },
      {
        STRIPE_SECRET_KEY: 'sk_test_x',
        RESEND_API_KEY: 're_y',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-example',
      },
    ];
    for (const env of variants) {
      const body = stableSnapshot(env);
      expect(withoutRequestId(body)).toEqual(withoutRequestId(baseline));
      expect(JSON.stringify(body)).not.toMatch(/sk_(live|test)_/);
      expect(JSON.stringify(body)).not.toContain('re_example');
      expect(JSON.stringify(body)).not.toContain('service-role-example');
      for (const key of Object.keys(body)) {
        expect(key).not.toMatch(/^(stripe|email|sandbox)/i);
      }
      assertPublicHealthShape(body);
    }
  });

  it('changes only requestId when the same inputs are serialized with different ids', () => {
    const a = healthSnapshot({ configured: true, databaseOk: true, requestId: 'aaa' });
    const b = healthSnapshot({ configured: true, databaseOk: true, requestId: 'bbb' });
    expect(withoutRequestId(a)).toEqual(withoutRequestId(b));
    expect(a.requestId).not.toBe(b.requestId);
  });
});