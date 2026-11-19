import { describe, expect, it } from 'vitest';
import { assertLocalAuctionFixtureTargets } from '../e2e/helpers/local-auction-fixture';

describe('auction fixture expiry safety', () => {
  it.each(['15432', '54322'])('accepts documented disposable loopback DB port %s', (port) => {
    expect(() => assertLocalAuctionFixtureTargets('http://localhost:3000', `postgresql://127.0.0.1:${port}/postgres`)).not.toThrow();
  });
  it.each([
    ['https://staging.example.test', 'postgresql://localhost:15432/postgres'],
    ['http://localhost:3000', 'postgresql://project.supabase.co:54322/postgres'],
    ['http://localhost.evil.test:3000', 'postgresql://localhost:15432/postgres'],
    ['http://localhost:3000', 'postgresql://localhost:5432/postgres'],
    ['http://localhost:3000', 'not-a-url'],
  ])('refuses unsafe fixture targets', (app, database) => {
    expect(() => assertLocalAuctionFixtureTargets(app, database)).toThrow('Auction fixtures require the disposable loopback test stack.');
  });
});
