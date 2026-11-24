import 'server-only';

import { serviceRoleClient } from '@/lib/server/service-role';

export const ACCOUNT_DELETE_STAFF_MESSAGE =
  'Staff accounts cannot be deleted here.';

export const ACCOUNT_DELETE_VIEWER_UNAVAILABLE_MESSAGE =
  'Account deletion is unavailable until your profile can be verified. Refresh and try again.';

export const ACCOUNT_DELETE_BLOCKED_MESSAGE =
  'Close or complete your published listings, active auctions, bids in ongoing auctions, open reservations or pending promotions before deleting your account, or send a deletion request to the data-protection contact in our privacy notice.';

export const ACCOUNT_DELETE_HAS_HISTORY_MESSAGE =
  "Your account can't be deleted automatically because it has activity on record. Your right to erasure still applies: send a deletion request to the data-protection contact in our privacy notice. We will reply within one month and tell you what we erase, anonymise or keep, and why.";

export const ACCOUNT_DELETE_NOT_FOUND_MESSAGE = 'Account not found.';

export type AccountDeleteBlockReason =
  | 'not_found'
  | 'staff'
  | 'published_listings'
  | 'active_auctions'
  | 'open_bids'
  | 'open_reservations'
  | 'open_promotions'
  | 'has_history';

/** Returns null when hard deletion may proceed; otherwise the blocking reason. */
export async function accountDeleteBlockReason(
  userId: string,
): Promise<AccountDeleteBlockReason | null> {
  const { data, error } = await serviceRoleClient().rpc(
    'account_delete_eligibility',
    { p_user_id: userId },
  );
  if (error) throw error;
  if (data == null || data === '') return null;
  return data as AccountDeleteBlockReason;
}
