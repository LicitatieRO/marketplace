import 'server-only';

import { serviceRoleClient } from '@/lib/server/service-role';

export const ACCOUNT_DELETE_STAFF_MESSAGE =
  'Staff accounts cannot be deleted here.';

export const ACCOUNT_DELETE_BLOCKED_MESSAGE =
  'Close your published listings, active auctions, open bids, reservations, promotions, or content reports linked to your email before deleting your account.';

export type AccountDeleteBlockReason =
  | 'published_listings'
  | 'active_auctions'
  | 'open_bids'
  | 'open_reservations'
  | 'open_promotions'
  | 'dsa_notices';

/** Returns null when deletion may proceed; otherwise the blocking reason. */
export async function accountDeleteBlockReason(
  userId: string,
  userEmail: string,
): Promise<AccountDeleteBlockReason | null> {
  const db = serviceRoleClient();
  const app = db.schema('app');

  const [
    { count: listings, error: listingsError },
    { count: auctions, error: auctionsError },
    { count: reservations, error: reservationsError },
    { count: promos, error: promosError },
  ] = await Promise.all([
    app
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .eq('status', 'published'),
    app
      .from('auctions')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .in('status', ['scheduled', 'active']),
    app
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .or(`owner_id.eq.${userId},buyer_id.eq.${userId}`)
      .in('status', ['requested', 'funded']),
    app
      .from('property_promos')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .in('status', ['pending', 'active']),
  ]);

  if (listingsError) throw listingsError;
  if (auctionsError) throw auctionsError;
  if (reservationsError) throw reservationsError;
  if (promosError) throw promosError;

  if ((listings ?? 0) > 0) return 'published_listings';
  if ((auctions ?? 0) > 0) return 'active_auctions';
  if ((reservations ?? 0) > 0) return 'open_reservations';
  if ((promos ?? 0) > 0) return 'open_promotions';

  const { data: bidRows, error: bidsError } = await app
    .from('bids')
    .select('auction_id')
    .eq('bidder_id', userId);
  if (bidsError) throw bidsError;
  const auctionIds = Array.from(
    new Set((bidRows || []).map((row) => row.auction_id as string)),
  );
  if (auctionIds.length > 0) {
    const { count: openBids, error: openBidsError } = await app
      .from('auctions')
      .select('id', { count: 'exact', head: true })
      .in('id', auctionIds)
      .in('status', ['scheduled', 'active']);
    if (openBidsError) throw openBidsError;
    if ((openBids ?? 0) > 0) return 'open_bids';
  }

  const email = userEmail.trim();
  if (email) {
    const { count: notices, error: noticesError } = await app
      .from('dsa_notices')
      .select('id', { count: 'exact', head: true })
      .ilike('notifier_email', email);
    if (noticesError) throw noticesError;
    if ((notices ?? 0) > 0) return 'dsa_notices';
  }

  return null;
}
