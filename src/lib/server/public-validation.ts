import type { ZodError } from 'zod';
import type { Language } from '@/lib/types';
import { translate } from '@/lib/i18n';

export const publicValidationCodes = [
  'dsa_notice_too_short',
  'invalid_email',
  'required_field',
] as const;

export type PublicValidationCode = (typeof publicValidationCodes)[number];

const publicValidationMessages: Record<PublicValidationCode, [string, string]> = {
  dsa_notice_too_short: [
    'Explicația trebuie să aibă cel puțin 30 de caractere.',
    'Your explanation must be at least 30 characters.',
  ],
  invalid_email: ['Introdu o adresă de email validă.', 'Enter a valid email address.'],
  required_field: ['Completează acest câmp obligatoriu.', 'This required field is missing.'],
};

export class PublicValidationError extends Error {
  readonly code: PublicValidationCode;
  readonly status: number;

  constructor(code: PublicValidationCode, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
    this.name = 'PublicValidationError';
  }
}

export function validationError(code: PublicValidationCode, status = 400): PublicValidationError {
  return new PublicValidationError(code, status);
}

export function publicValidationMessage(code: PublicValidationCode, language: Language = 'en'): string {
  const [ro, en] = publicValidationMessages[code];
  return translate(language, ro, en);
}

export function languageFromRequest(headers: Headers): Language {
  const accept = headers.get('accept-language') ?? '';
  const primary = accept.split(',')[0]?.trim().toLowerCase().split('-')[0];
  return primary === 'ro' ? 'ro' : 'en';
}

function issuePath(issue: { path: PropertyKey[] }): string {
  return issue.path.map(String).join('.');
}

export function mapZodErrorToPublicValidation(error: ZodError): PublicValidationError | null {
  for (const issue of error.issues) {
    const path = issuePath(issue);
    if (
      path === 'explanation' &&
      issue.code === 'too_small' &&
      'minimum' in issue &&
      issue.minimum === 30
    ) {
      return validationError('dsa_notice_too_short');
    }
    if (
      (path === 'email' || path === 'notifier_email') &&
      issue.code === 'invalid_format' &&
      'format' in issue &&
      issue.format === 'email'
    ) {
      return validationError('invalid_email');
    }
    if (
      path === 'notifier_name' &&
      issue.code === 'too_small' &&
      'minimum' in issue &&
      issue.minimum === 1
    ) {
      return validationError('required_field');
    }
  }
  return null;
}
