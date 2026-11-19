import 'server-only';

import { serviceRoleClient } from '@/lib/server/service-role';

export const ACCOUNT_DELETE_STAFF_MESSAGE =
  'Staff accounts cannot be deleted here.';

export const ACCOUNT_DELETE_VIEWER_UNAVAILABLE_MESSAGE =
  'Account deletion is unavailable until your profile can be verified. Refresh and try again.';

export const ACCOUNT_DELETE_BLOCKED_MESSAGE =
  'Close your published listings, active auctions, open bids, reservations, promotions, or content reports linked to your email before deleting your account.';

export const ACCOUNT_DELETE_HAS_HISTORY_MESSAGE =
  'Your account cannot be deleted automatically because it has marketplace activity on record. Send a deletion request to the GDPR contact address in our privacy notice; we will respond within 30 calendar days. Data we must keep for legal reasons may be retained or anonymised instead of being erased.';

export const ACCOUNT_DELETE_NOT_FOUND_MESSAGE = 'Account not found.';

export type AccountDeleteBlockReason =
  | 'not_found'
  | 'staff'
  | 'published_listings'
  | 'active_auctions'
  | 'open_bids'
  | 'open_reservations'
  | 'open_promotions'
  | 'dsa_notices'
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
