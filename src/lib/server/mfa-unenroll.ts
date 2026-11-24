import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MFA_UNENROLL_STAFF_LAST_FACTOR_CODE } from '@/lib/mfa-unenroll-messages';
import { RequestError } from '@/lib/security';
import { serviceRoleClient } from '@/lib/server/service-role';

export const MFA_UNENROLL_CLAIMS_ERROR = 'MFA_UNENROLL_CLAIMS_ERROR';

type MfaClaimsResult = {
  data: { claims?: { aal?: unknown } } | null;
  error: unknown;
};

export function aalForMfaUnenroll(claimsResult: MfaClaimsResult): string {
  if (claimsResult.error) {
    console.error('mfa.unenroll_claims_failed', {
      reason: MFA_UNENROLL_CLAIMS_ERROR,
    });
    return 'aal1';
  }
  return String(claimsResult.data?.claims?.aal ?? 'aal1');
}

export const MFA_UNENROLL_GENERIC = 'Unable to remove authenticator.';
export const MFA_UNENROLL_AAL =
  'Verify your session before removing an authenticator.';
export const MFA_UNENROLL_BLOCKED =
  'This change is unavailable. Refresh and try again.';
export const MFA_UNENROLL_SESSION_REFRESH =
  'Authenticator removed. Sign in again to refresh your session.';

export type MfaUnenrollResult = {
  sessionRefreshFailed: boolean;
};

type TotpFactor = { id: string; status: string };

function totpFactors(
  data: { totp?: TotpFactor[] } | null | undefined,
): TotpFactor[] {
  return data?.totp ?? [];
}

export async function unenrollMfaFactor(
  db: SupabaseClient,
  factorId: string,
  context: { aal: string; isStaff: boolean },
): Promise<MfaUnenrollResult> {
  const { data: listed, error: listError } = await db.auth.mfa.listFactors();
  if (listError) throw new RequestError(MFA_UNENROLL_GENERIC);

  const totp = totpFactors(listed);
  const factor = totp.find((item) => item.id === factorId);
  if (!factor) throw new RequestError(MFA_UNENROLL_GENERIC);

  const verifiedFactors = totp.filter((item) => item.status === 'verified');
  const removingVerified = factor.status === 'verified';

  if (removingVerified && context.aal !== 'aal2') {
    throw new RequestError(MFA_UNENROLL_AAL, 403);
  }

  if (
    removingVerified &&
    context.isStaff &&
    verifiedFactors.length === 1 &&
    verifiedFactors[0]?.id === factorId
  ) {
    throw new RequestError(
      MFA_UNENROLL_BLOCKED,
      403,
      MFA_UNENROLL_STAFF_LAST_FACTOR_CODE,
    );
  }

  const { error: unenrollError } = await db.auth.mfa.unenroll({ factorId });
  if (unenrollError) throw new RequestError(MFA_UNENROLL_GENERIC);

  const { error: refreshError } = await db.auth.refreshSession();
  return { sessionRefreshFailed: Boolean(refreshError) };
}

export async function recordMfaFactorUnenrolledAudit(
  userId: string,
  factorId: string,
): Promise<void> {
  const { error: auditError } = await serviceRoleClient().rpc(
    'audit_mfa_factor_unenrolled',
    {
      p_user_id: userId,
      p_factor_id: factorId,
    },
  );
  if (auditError) {
    console.error('mfa.unenroll_audit_failed', {
      reason: 'audit_rpc_error',
    });
  }
}
