import 'server-only';
import { isServiceRoleConfigured } from '@/lib/server/notifications-db';
import { serviceRoleClient } from '@/lib/server/service-role';

const MFA_VERIFY_DENIED = 'Invalid or expired authenticator code.';
const MFA_VERIFY_UNAVAILABLE =
  'Authenticator verification is temporarily unavailable.';

export type MfaVerifyReserveResult = 'allowed' | 'denied' | 'unavailable';

async function mfaRateCall(
  userId: string,
  factorId: string,
  clientIp: string | null,
  operation: 'attempt' | 'reset',
): Promise<boolean | null> {
  if (!isServiceRoleConfigured()) {
    console.error(
      'MFA verify rate limit unavailable: SUPABASE_SECRET_KEY is not configured.',
    );
    return null;
  }
  const db = serviceRoleClient();
  const { data, error } = await db.rpc('mfa_verify_rate_limit', {
    p_user_id: userId,
    p_factor_id: factorId,
    p_client_ip: clientIp ?? '',
    p_operation: operation,
  });
  if (error) {
    console.error('MFA verify rate limit RPC failed.');
    return null;
  }
  const allowed = (data as { allowed?: boolean } | null)?.allowed;
  return allowed === true;
}

export { MFA_VERIFY_DENIED, MFA_VERIFY_UNAVAILABLE };

/** Reserve one verify attempt under row lock before calling Supabase verify. */
export async function mfaVerifyReserveAttempt(
  userId: string,
  factorId: string,
  clientIp: string | null,
): Promise<MfaVerifyReserveResult> {
  const allowed = await mfaRateCall(userId, factorId, clientIp, 'attempt');
  if (allowed === null) return 'unavailable';
  return allowed ? 'allowed' : 'denied';
}

export async function mfaVerifyResetOnSuccess(userId: string, factorId: string): Promise<void> {
  await mfaRateCall(userId, factorId, '', 'reset');
}
