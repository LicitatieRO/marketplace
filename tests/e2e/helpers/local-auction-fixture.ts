import pg from 'pg';

export function assertLocalAuctionFixtureTargets(app: string, database: string) {
  try {
    const appUrl = new URL(app), dbUrl = new URL(database);
    if (appUrl.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(appUrl.hostname)) throw new Error();
    if (!['postgres:', 'postgresql:'].includes(dbUrl.protocol) || !['localhost', '127.0.0.1'].includes(dbUrl.hostname) || !['15432', '54322'].includes(dbUrl.port)) throw new Error();
  } catch { throw new Error('Auction fixtures require the disposable loopback test stack.'); }
}

/** Test-only time travel for a fixture created by this journey, never an application endpoint. */
export async function expireLocalAuctionFixture(app: string, fixture: { auctionId: string; propertyId: string; ownerId: string }) {
  const database = process.env.DATABASE_URL || '';
  assertLocalAuctionFixtureTargets(app, database);
  if (process.env.E2E_BACKEND !== '1') throw new Error('Backend test mode required for fixture expiry.');
  const db = new pg.Client({ connectionString: database });
  try {
    await db.connect();
    await db.query('BEGIN');
    const property = await db.query('SELECT id FROM app.properties WHERE id=$1 AND owner_id=$2 FOR UPDATE', [fixture.propertyId, fixture.ownerId]);
    if (property.rowCount !== 1) throw new Error();
    const auction = await db.query("UPDATE app.auctions SET ends_at=clock_timestamp()-interval '1 millisecond' WHERE id=$1 AND property_id=$2 AND owner_id=$3 RETURNING id", [fixture.auctionId, fixture.propertyId, fixture.ownerId]);
    if (auction.rowCount !== 1) throw new Error();
    await db.query('COMMIT');
  } catch {
    await db.query('ROLLBACK').catch(() => undefined);
    throw new Error('Disposable auction fixture expiry failed.');
  } finally { await db.end(); }
}
