export type MfaTotpFactorRow = {
  id: string;
  status: string;
  friendly_name?: string;
  friendlyName?: string;
  factor_type?: string;
  factorType?: string;
  created_at?: string;
  createdAt?: string;
};

export function mfaFactorDisplayLabel(factor: MfaTotpFactorRow): string {
  const friendly =
    factor.friendly_name?.trim() || factor.friendlyName?.trim() || '';
  if (friendly) return friendly;
  const type = (
    factor.factor_type ||
    factor.factorType ||
    'totp'
  ).toLowerCase();
  return `${type} · ${factor.id.slice(0, 8)}`;
}

export function mfaUnenrollPostBody(factorId: string) {
  return { action: 'unenroll' as const, factorId };
}

export function verifiedTotpFactors(
  totp: MfaTotpFactorRow[] | null | undefined,
): MfaTotpFactorRow[] {
  return (totp ?? []).filter((item) => item.status === 'verified');
}
