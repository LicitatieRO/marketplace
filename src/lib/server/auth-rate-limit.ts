import 'server-only';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  AUTH_HTTP_RATE_LIMITS,
  type AuthHttpRateLimitAction,
  type AuthRateLimitBucket,
} from '@/lib/server/auth-rate-limit-config';
import { parseableClientIp, rateLimitIpKeyMaterial, trustedClientIp } from '@/lib/server/client-ip';
import { isServiceRoleConfigured } from '@/lib/server/notifications-db';
import { serviceRoleClient } from '@/lib/server/service-role';

export const AUTH_RATE_LIMIT_MESSAGE =
  'Too many attempts. Please try again later.';

export const AUTH_RATE_LIMIT_UNAVAILABLE_MESSAGE =
  'Service temporarily unavailable. Please try again shortly.';

const SIGN_IN_FAIL_OPEN_LOG = 'AUTH_RATE_LIMIT_SIGN_IN_FAIL_OPEN';
const AUTH_FAIL_CLOSED_LOG = 'AUTH_RATE_LIMIT_FAIL_CLOSED';

export function authRateLimitKeyHash(scope: string, kind: 'ip' | 'identifier', value: string): string {
  const normalized =
    kind === 'identifier' ? value.trim().toLowerCase() : rateLimitIpKeyMaterial(value);
  return createHash('sha256')
    .update(`auth-http:${scope}:${kind}:${normalized}`, 'utf8')
    .digest('hex');
}

type ConsumeResult =
  | { status: 'allowed' }
  | { status: 'denied'; retryAfterSeconds: number }
  | { status: 'unavailable' };

async function consumeBucket(
  keyHash: string,
  bucket: AuthRateLimitBucket,
  increment = true,
): Promise<ConsumeResult> {
  if (!isServiceRoleConfigured()) {
    return { status: 'unavailable' };
  }
  const db = serviceRoleClient();
  const { data, error } = await db.rpc('auth_http_rate_limit_consume', {
    p_key_hash: keyHash,
    p_limit: bucket.max,
    p_window_seconds: bucket.windowSeconds,
    p_increment: increment,
  });
  if (error) {
    console.error('Auth HTTP rate limit RPC failed.');
    return { status: 'unavailable' };
  }
  const payload = data as { allowed?: boolean; retry_after_seconds?: number } | null;
  if (payload?.allowed === true) return { status: 'allowed' };
  const retry = Number(payload?.retry_after_seconds);
  return {
    status: 'denied',
    retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : bucket.windowSeconds,
  };
}

export function authRateLimitResponse(retryAfterSeconds: number): NextResponse {
  const retry = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    { error: AUTH_RATE_LIMIT_MESSAGE },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': String(retry),
      },
    },
  );
}

function unavailableResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}

function policyRequiresClientIp(action: AuthHttpRateLimitAction): boolean {
  const policy = AUTH_HTTP_RATE_LIMITS[action];
  if (!policy.ip) return false;
  return !('identifier' in policy && policy.identifier);
}

async function checkPolicy(
  action: AuthHttpRateLimitAction,
  ip: string | null,
  identifier: string | null,
  increment = true,
): Promise<ConsumeResult> {
  const policy = AUTH_HTTP_RATE_LIMITS[action];
  if (policy.ip) {
    if (!ip) {
      if (policyRequiresClientIp(action)) {
        return { status: 'unavailable' };
      }
    } else {
      const ipResult = await consumeBucket(
        authRateLimitKeyHash(action, 'ip', ip),
        policy.ip,
        increment,
      );
      if (ipResult.status !== 'allowed') return ipResult;
    }
  }
  const idBucket = 'identifier' in policy ? policy.identifier : undefined;
  if (idBucket && identifier) {
    const idResult = await consumeBucket(
      authRateLimitKeyHash(action, 'identifier', identifier),
      idBucket,
      increment,
    );
    if (idResult.status !== 'allowed') return idResult;
  }
  return { status: 'allowed' };
}

function toBlockedResponse(
  action: AuthHttpRateLimitAction,
  result: ConsumeResult,
): NextResponse | null {
  if (result.status === 'denied') {
    return authRateLimitResponse(result.retryAfterSeconds);
  }
  if (result.status === 'unavailable') {
    if (action === 'signIn') {
      console.error(SIGN_IN_FAIL_OPEN_LOG);
      return null;
    }
    console.error(AUTH_FAIL_CLOSED_LOG, { action });
    return unavailableResponse(AUTH_RATE_LIMIT_UNAVAILABLE_MESSAGE);
  }
  return null;
}

/** Returns a 429/503 response when limited or closed; null when the request may proceed. */
export async function enforceAuthHttpRateLimit(
  headers: Headers,
  action: AuthHttpRateLimitAction,
  identifier?: string | null,
  options?: { increment?: boolean },
): Promise<NextResponse | null> {
  const ip = parseableClientIp(trustedClientIp(headers));
  const email = identifier?.trim() ? identifier : null;
  const increment = options?.increment !== false;
  const result = await checkPolicy(action, ip, email, increment);
  return toBlockedResponse(action, result);
}

/** Block sign-in when buckets are already full (peek only; no increment). */
export async function peekAuthSignInRateLimit(
  headers: Headers,
  identifier: string,
): Promise<NextResponse | null> {
  const result = await checkPolicy('signIn', parseableClientIp(trustedClientIp(headers)), identifier, false);
  return toBlockedResponse('signIn', result);
}

/** Count a failed sign-in attempt against IP and identifier buckets. */
export async function recordAuthSignInFailure(
  headers: Headers,
  identifier: string,
): Promise<void> {
  await checkPolicy('signIn', parseableClientIp(trustedClientIp(headers)), identifier, true);
}
