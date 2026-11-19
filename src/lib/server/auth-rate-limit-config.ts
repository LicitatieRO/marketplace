import 'server-only';

export type AuthRateLimitBucket = {
  max: number;
  windowSeconds: number;
};

export type AuthRateLimitPolicy = {
  ip?: AuthRateLimitBucket;
  identifier?: AuthRateLimitBucket;
};

/** Central auth HTTP rate-limit thresholds (see issue #50). */
export const AUTH_HTTP_RATE_LIMITS = {
  signIn: {
    ip: { max: 10, windowSeconds: 15 * 60 },
    identifier: { max: 5, windowSeconds: 15 * 60 },
  },
  signUp: {
    ip: { max: 5, windowSeconds: 60 * 60 },
  },
  recover: {
    ip: { max: 10, windowSeconds: 60 * 60 },
    identifier: { max: 3, windowSeconds: 60 * 60 },
  },
  dsaNotice: {
    ip: { max: 5, windowSeconds: 60 * 60 },
  },
  accountDelete: {
    ip: { max: 10, windowSeconds: 60 * 60 },
    identifier: { max: 3, windowSeconds: 60 * 60 },
  },
  accountUnlink: {
    ip: { max: 20, windowSeconds: 15 * 60 },
    identifier: { max: 10, windowSeconds: 15 * 60 },
  },
} as const satisfies Record<string, AuthRateLimitPolicy>;

export type AuthHttpRateLimitAction = keyof typeof AUTH_HTTP_RATE_LIMITS;
