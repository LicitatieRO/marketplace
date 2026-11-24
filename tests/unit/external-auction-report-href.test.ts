import { describe, expect, it } from "vitest";
import { externalAuctionDsaReportHref } from "@/lib/external-auction-report-href";

describe("externalAuctionDsaReportHref", () => {
  it("points at the DSA notice form that posts to /api/dsa-notices", () => {
    const href = externalAuctionDsaReportHref(
      "11111111-1111-4111-8111-111111111111",
      "repes:SYNTH:1",
    );
    expect(href).toMatch(/^\/dsa-notices\/report\?/);
    expect(href).not.toContain("/legal/privacy");
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("listing_id")).toBe("11111111-1111-4111-8111-111111111111");
    expect(params.get("external_source_id")).toBe("repes:SYNTH:1");
  });
});