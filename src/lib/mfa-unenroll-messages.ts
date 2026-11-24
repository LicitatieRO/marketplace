export const MFA_UNENROLL_STAFF_LAST_FACTOR_CODE =
  'MFA_UNENROLL_STAFF_LAST_FACTOR';

type MfaUnenrollErrorBody = {
  error?: string;
  code?: string;
};

export function mfaUnenrollApiErrorMessage(
  body: MfaUnenrollErrorBody,
  t: (ro: string, en: string) => string,
  fallback: string,
): string {
  if (body.code === MFA_UNENROLL_STAFF_LAST_FACTOR_CODE) {
    return t(
      'Contururile staff nu pot elimina ultimul autentificator verificat. Adaugă un factor de rezervă înainte de a-l scoate pe acesta.',
      'Staff accounts cannot remove the last verified authenticator. Enroll a backup factor before removing this one.',
    );
  }
  return body.error ?? fallback;
}
