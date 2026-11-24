import "server-only";
import { isConfigured } from "@/lib/config";
import type { ExternalAuctionListing } from "@/lib/types-external-auction";
import { getSupabase } from "@/lib/server/supabase";
import { loadSyntheticRepesFixture } from "@/lib/server/repes-client";
import { filterBucharestIlfovRepesEntries } from "@/lib/repes/region-filter";
import { redactRepesAuctionEntry } from "@/lib/repes/redact";
import { hashRepesCaseId } from "@/lib/server/repes-case-id-hash";
import { isAllowedRepesSourceUrl } from "@/lib/repes/source-url";

function fixtureListings(): ExternalAuctionListing[] {
  const now = new Date().toISOString();
  return filterBucharestIlfovRepesEntries(loadSyntheticRepesFixture().entries)
    .map((entry) => {
      const caseHash = hashRepesCaseId(entry.caseId);
      return redactRepesAuctionEntry(entry, caseHash);
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .map((row, index) => {
      const ended = new Date(row.auction_at).getTime() < Date.now();
      return {
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
        ended_at_source: ended,
      };
    });
}

function sanitizeListingRow(row: ExternalAuctionListing): ExternalAuctionListing | null {
  if (!isAllowedRepesSourceUrl(row.source_url)) return null;
  return row;
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
  return ((data ?? []) as ExternalAuctionListing[])
    .map(sanitizeListingRow)
    .filter((row): row is ExternalAuctionListing => row !== null);
}
