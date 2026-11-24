/**
 * DSA notice-and-action entry point (same flow as listing illegal-content reports).
 * Uses a platform anchor listing id; the reporter describes the external notice in the explanation field.
 */
export function externalAuctionDsaReportHref(
  anchorListingId: string,
  externalSourceId: string,
): string {
  const params = new URLSearchParams({
    external_source_id: externalSourceId,
  });
  return `/listings/${anchorListingId}/report?${params.toString()}`;
}
