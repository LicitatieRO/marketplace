import { isConfigured } from '@/lib/config';

export type HealthBody = {
  status: 'ok' | 'unavailable' | 'unconfigured';
  database: boolean;
  ready: boolean;
  liveDeposits: false;
  poc: true;
  requestId: string;
  appMode?: string;
};

type HealthEnv = Record<string, string | undefined>;

function explicitAppMode(env: HealthEnv): string | undefined {
  const value = env.NEXT_PUBLIC_APP_MODE ?? env.APP_ENV;
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function healthSnapshot(
  options: {
    configured?: boolean;
    databaseOk?: boolean;
    requestId?: string;
    env?: HealthEnv;
  } = {},
): HealthBody {
  const env = options.env ?? process.env;
  const configured = options.configured ?? isConfigured();
  const databaseOk = options.databaseOk ?? false;
  const status: HealthBody['status'] = !configured
    ? 'unconfigured'
    : databaseOk
      ? 'ok'
      : 'unavailable';

  const body: HealthBody = {
    status,
    database: configured ? databaseOk : false,
    ready: configured && databaseOk,
    liveDeposits: false,
    poc: true,
    requestId: options.requestId ?? '',
  };

  const appMode = explicitAppMode(env);
  if (appMode) body.appMode = appMode;

  return body;
}

export function healthStatusCode(body: HealthBody): number {
  return body.status === 'ok' ? 200 : 503;
}

const SECRET_SHAPE_KEY = /^(stripe|email|sandbox)/i;

export function assertPublicHealthShape(body: HealthBody): void {
  for (const key of Object.keys(body)) {
    if (SECRET_SHAPE_KEY.test(key)) {
      throw new Error(`Unexpected public health field: ${key}`);
    }
  }
}