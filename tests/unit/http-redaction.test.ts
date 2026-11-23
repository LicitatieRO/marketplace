import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { databaseFailure, failure } from '@/lib/server/http';
import { RequestError } from '@/lib/security';
import { ZodError } from 'zod';
import { PublicValidationError, validationError } from '@/lib/server/public-validation';

describe('server error privacy', () => {
  it('redacts private 5xx RequestError text', async () => {
    const response = failure(new RequestError('secret token and address', 500));
    expect(await response.json()).toEqual({
      error: 'The request could not be completed. Please try again.',
    });
  });

  it('returns allowlisted public validation messages for 4xx', async () => {
    const response = failure(validationError('dsa_notice_too_short'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Your explanation must be at least 30 characters.',
    });
    const localized = failure(validationError('invalid_email'), { language: 'ro' });
    expect(await localized.json()).toEqual({
      error: 'Introdu o adresă de email validă.',
    });
  });

  it('redacts raw Zod issue text and private database message keywords', async () => {
    const zodResponse = failure(
      new ZodError([{ code: 'custom', path: [], message: 'email alice@example.test token private' }]),
    );
    const zodBody = await zodResponse.json();
    expect(JSON.stringify(zodBody)).not.toContain('alice@example.test');
    expect(zodResponse.status).toBe(400);
    expect(zodBody).toEqual({ error: 'Invalid request.' });

    const dbResponse = databaseFailure({
      code: 'P0001',
      message: 'permission denied for alice@example.test at 123 Main Street, bid 50000',
    });
    expect(await dbResponse.json()).toEqual({
      error: 'This change is unavailable. Refresh and try again.',
    });
  });

  it('redacts non-allowlisted validation codes and unknown errors', async () => {
    const unlisted = new PublicValidationError('invalid_email');
    Object.assign(unlisted, { code: 'not_on_allowlist' });
    expect(await failure(unlisted).json()).toEqual({ error: 'Invalid request.' });

    const zodResponse = failure(
      new ZodError([{ code: 'custom', path: ['listing_id'], message: 'uuid secret-token leak' }]),
    );
    const zodBody = await zodResponse.json();
    expect(zodBody).toEqual({ error: 'Invalid request.' });
    expect(JSON.stringify(zodBody)).not.toContain('secret-token');

    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('password');
    error.name = 'alice@example.test';
    const unknown = failure(error);
    expect(JSON.stringify(log.mock.calls)).not.toContain('alice@example.test');
    expect(await unknown.json()).toEqual({
      error: 'The request could not be completed. Please try again.',
    });
    log.mockRestore();
  });

  it('does not return private text from a database message containing an allowed keyword', async () => {
    const response = databaseFailure({
      code: 'P0001',
      message: 'permission denied for alice@example.test at 123 Main Street, bid 50000',
    });
    expect(await response.json()).toEqual({
      error: 'This change is unavailable. Refresh and try again.',
    });
  });

  it.each([
    'alice@example.test',
    'eyJhbGciOiJIUzI1NiJ9.fake.signature',
    'password=private',
    'x-vercel-protection-bypass=private',
    '123 Main Street',
    'deposit 50000',
  ])('does not expose sensitive database detail: %s', async (secret) => {
    const response = databaseFailure({ code: 'P0001', message: `permission ${secret}` });
    expect(JSON.stringify(await response.json())).not.toContain(secret);
  });

  it('preserves a known safe unavailable-service message', async () => {
    const response = failure(new RequestError('Authenticator verification is temporarily unavailable.', 503));
    expect(await response.json()).toEqual({
      error: 'Authenticator verification is temporarily unavailable.',
    });
  });

  it('preserves a known safe database message', async () => {
    const response = databaseFailure({ code: 'P0001', message: 'Auction is not accepting bids' });
    expect(await response.json()).toEqual({ error: 'Auction is not accepting bids' });
  });
});