/**
 * DSA notice-and-action form (posts to POST /api/dsa-notices via DsaReportForm).
 * Anchor listing_id satisfies DSA schema; external_source_id is carried in the explanation.
 */
export function externalAuctionDsaReportHref(
  anchorListingId: string,
  externalSourceId: string,
): string {
  const params = new URLSearchParams({
    listing_id: anchorListingId,
    external_source_id: externalSourceId,
  });
  return `/dsa-notices/report?${params.toString()}`;
}
