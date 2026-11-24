import "server-only";
import { filterBucharestIlfovRepesEntries } from "@/lib/repes/region-filter";
import { redactRepesAuctionEntry } from "@/lib/repes/redact";
import {
  collectRepesPages,
  fetchRepesAuctionPages,
} from "@/lib/server/repes-client";
import { hashRepesCaseId } from "@/lib/server/repes-case-id-hash";
import { serviceRoleClient } from "@/lib/server/service-role";

export type RepesIngestSummary = {
  fetched: number;
  filtered: number;
  upserted: number;
  skipped: number;
  purged: number;
};

export async function runRepesIngest(options: {
  useFixture?: boolean;
  maxPages?: number;
}): Promise<RepesIngestSummary> {
  const pages = await fetchRepesAuctionPages({
    useFixture: options.useFixture,
    maxPages: options.maxPages,
  });
  const fetched = pages.reduce(
    (sum, p) => sum + (p.entries?.length ?? 0),
    0,
  );
  const regional = filterBucharestIlfovRepesEntries(collectRepesPages(pages));
  const redacted = regional
    .map((entry) => {
      const caseHash = hashRepesCaseId(entry.caseId);
      return redactRepesAuctionEntry(entry, caseHash);
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const db = serviceRoleClient();
  const purgedResult = await db.rpc("purge_stale_external_auction_listings");
  const purged =
    typeof purgedResult.data === "number" ? purgedResult.data : 0;

  let upserted = 0;
  for (const row of redacted) {
    const { error } = await db.rpc("upsert_external_auction_listing", {
      p_source: row.source,
      p_source_id: row.source_id,
      p_repes_case_id: row.repes_case_id,
      p_repes_auction_id: row.repes_auction_id,
      p_category: row.category,
      p_property_type: row.property_type,
      p_locality_label: row.locality_label,
      p_judet: row.judet,
      p_area_sqm: row.area_sqm,
      p_price_minor: row.price_minor,
      p_currency: row.currency,
      p_guarantee_minor: row.guarantee_minor,
      p_auction_at: row.auction_at,
      p_issuing_authority: row.issuing_authority,
      p_source_url: row.source_url,
      p_withdrawn: row.withdrawn,
    });
    if (!error) upserted += 1;
  }

  return {
    fetched,
    filtered: regional.length,
    upserted,
    skipped: regional.length - redacted.length,
    purged,
  };
}
