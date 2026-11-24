import "server-only";
import { filterBucharestIlfovRepesEntries } from "@/lib/repes/region-filter";
import { redactRepesAuctionEntry } from "@/lib/repes/redact";
import { fetchRepesAuctionPage } from "@/lib/server/repes-client";
import { serviceRoleClient } from "@/lib/server/service-role";

export type RepesIngestSummary = {
  fetched: number;
  filtered: number;
  upserted: number;
  skipped: number;
};

export async function runRepesIngest(options: {
  useFixture?: boolean;
  maxPages?: number;
}): Promise<RepesIngestSummary> {
  const maxPages = Math.min(3, Math.max(1, options.maxPages ?? 1));
  const pages = [];
  for (let page = 0; page < maxPages; page += 1) {
    pages.push(
      await fetchRepesAuctionPage({
        page,
        pageSize: 25,
        fixture: options.useFixture,
      }),
    );
  }
  const fetched = pages.reduce(
    (sum, p) => sum + (p.entries?.length ?? 0),
    0,
  );
  const regional = filterBucharestIlfovRepesEntries(
    pages.flatMap((p) => p.entries ?? []),
  );
  const redacted = regional
    .map((entry) => redactRepesAuctionEntry(entry))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const db = serviceRoleClient();
  let upserted = 0;
  for (const row of redacted) {
    const { error } = await db.rpc("upsert_external_auction_listing", {
      p_source: row.source,
      p_source_id: row.source_id,
      p_repes_case_id: row.repes_case_id,
      p_repes_auction_id: row.repes_auction_id,
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
  };
}