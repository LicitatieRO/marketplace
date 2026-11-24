import "server-only";
import { isConfigured } from "@/lib/config";
import type { ExternalAuctionListing } from "@/lib/types-external-auction";
import { getSupabase } from "@/lib/server/supabase";
import { loadSyntheticRepesFixture } from "@/lib/server/repes-client";
import { filterBucharestIlfovRepesEntries } from "@/lib/repes/region-filter";
import { redactRepesAuctionEntry } from "@/lib/repes/redact";

function fixtureListings(): ExternalAuctionListing[] {
  const now = new Date().toISOString();
  return filterBucharestIlfovRepesEntries(loadSyntheticRepesFixture().entries)
    .map((entry) => redactRepesAuctionEntry(entry))
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .map((row, index) => ({
      id: `fixture-repes-${index + 1}`,
      source: row.source,
      source_id: row.source_id,
      category: row.category,
      property_type: row.property_type,
      locality_label: row.locality_label,
      judet: row.judet,
      area_sqm: row.area_sqm,
      price_minor: row.price_minor,
      currency: row.currency,
      guarantee_minor: row.guarantee_minor,
      auction_at: row.auction_at,
      issuing_authority: row.issuing_authority,
      source_url: row.source_url,
      retrieved_at: now,
      withdrawn: row.withdrawn,
    }));
}

export async function getExternalAuctionListings(): Promise<
  ExternalAuctionListing[]
> {
  if (!isConfigured()) return fixtureListings();
  const db = await getSupabase();
  const { data, error } = await db.rpc("get_external_auction_listings");
  if (error) {
    if (process.env.NODE_ENV !== "production") return fixtureListings();
    return [];
  }
  return (data ?? []) as ExternalAuctionListing[];
}
