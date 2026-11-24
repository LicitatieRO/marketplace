import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ExternalAuctionCardView,
  externalAuctionCardForbiddenControls,
} from "@/components/external-auction-card";
import type { ExternalAuctionListing } from "@/lib/types-external-auction";

const listing: ExternalAuctionListing = {
  id: "11111111-1111-4111-8111-111111111111",
  source: "repes",
  source_id: "repes:SYNTH:1",
  property_type: "apartment",
  locality_label: "Sector 2",
  judet: "București",
  area_sqm: 72,
  price_minor: 25000000,
  currency: "RON",
  guarantee_minor: 2500000,
  auction_at: "2026-12-10T10:00:00.000Z",
  issuing_authority: "Executor POC",
  source_url: "https://prod.executori.ro/repes/#/auction/SYNTH/1",
  retrieved_at: "2026-11-24T12:00:00.000Z",
  withdrawn: false,
};

describe("ExternalAuctionCard", () => {
  it("does not expose simulated bid or promotion controls", () => {
    expect(externalAuctionCardForbiddenControls()).toEqual([
      "place_bid",
      "confirm",
      "highest bidder",
      "promote",
    ]);
    const t = (ro: string) => ro;
    const html = renderToStaticMarkup(
      <ExternalAuctionCardView listing={listing} language="ro" t={t} />,
    );
    expect(html).toContain('data-testid="external-auction-card"');
    expect(html).not.toContain("place_bid");
    expect(html).not.toContain("catalogue-card-auction-meta");
    expect(html).not.toContain("highest bidder");
    expect(html).toContain('data-testid="external-auction-source-link"');
  });
});
