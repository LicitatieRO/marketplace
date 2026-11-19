import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { databaseFailure, failure } from '@/lib/server/http';
import { RequestError } from '@/lib/security';
import { ZodError } from 'zod';

describe('server error privacy', () => {
  it('does not return private text from a database message containing an allowed keyword', async () => {
    const response = databaseFailure({code:'P0001', message:'permission denied for alice@example.test at 123 Main Street, bid 50000'});
    expect(await response.json()).toEqual({error:'This change is unavailable. Refresh and try again.'});
  });
  it.each(['alice@example.test', 'eyJhbGciOiJIUzI1NiJ9.fake.signature', 'password=private', 'x-vercel-protection-bypass=private', '123 Main Street', 'deposit 50000'])('does not expose sensitive database detail: %s', async (secret) => {
    const response = databaseFailure({code:'P0001', message:`permission ${secret}`});
    expect(JSON.stringify(await response.json())).not.toContain(secret);
  });
  it('preserves a known safe unavailable-service message', async () => {
    const response = failure(new RequestError('Authenticator verification is temporarily unavailable.', 503));
    expect(await response.json()).toEqual({error:'Authenticator verification is temporarily unavailable.'});
  });
  it('hides private details from server-side RequestError responses', async () => {
    const response = failure(new RequestError('secret token and address', 500));
    expect(await response.json()).toEqual({error:'The request could not be completed. Please try again.'});
  });
  it('does not return sensitive validation issue text', async () => {
    const response = failure(new ZodError([{code:'custom', path:[], message:'email alice@example.test token private'}]));
    expect(JSON.stringify(await response.json())).not.toContain('alice@example.test');
    expect(response.status).toBe(400);
  });
  it('preserves a known safe database message', async () => {
    const response = databaseFailure({code:'P0001', message:'Auction is not accepting bids'});
    expect(await response.json()).toEqual({error:'Auction is not accepting bids'});
  });
  it('does not log a secret supplied as an Error name', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('password'); error.name = 'alice@example.test';
    const response = failure(error);
    expect(JSON.stringify(log.mock.calls)).not.toContain('alice@example.test');
    expect(await response.json()).toEqual({error:'The request could not be completed. Please try again.'});
    log.mockRestore();
  });
});
