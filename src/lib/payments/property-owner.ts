import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RequestError } from '@/lib/security';

type WorkspaceProperty = { id?: string };
type WorkspaceListing = { id?: string; property_id?: string; transaction_type?: string };

export async function assertOwnerOfProperty(db: SupabaseClient, userId: string, propertyId: string) {
  const { data, error } = await db.rpc('get_workspace');
  if (error) throw new RequestError('This change is unavailable. Refresh and try again.', 409);
  const properties = (data?.properties ?? []) as WorkspaceProperty[];
  if (!properties.some((row) => String(row.id) === propertyId)) {
    throw new RequestError('Owner required', 403);
  }
}

export function listingIdsForProperty(
  listings: WorkspaceListing[] | undefined,
  propertyId: string,
): { saleId: string | null; rentId: string | null } {
  const linked = (listings ?? []).filter((row) => String(row.property_id) === propertyId);
  return {
    saleId: linked.find((row) => row.transaction_type === 'sale')?.id ?? null,
    rentId: linked.find((row) => row.transaction_type === 'rent')?.id ?? null,
  };
}

export async function loadWorkspaceForOwner(db: SupabaseClient, userId: string, propertyId: string) {
  const { data, error } = await db.rpc('get_workspace');
  if (error) throw new RequestError('This change is unavailable. Refresh and try again.', 409);
  const properties = (data?.properties ?? []) as WorkspaceProperty[];
  if (!properties.some((row) => String(row.id) === propertyId)) {
    throw new RequestError('Owner required', 403);
  }
  return data as { listings?: WorkspaceListing[] };
}