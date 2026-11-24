export type ExternalAuctionListing = {
  id: string;
  source: "repes";
  source_id: string;
  property_type: string;
  locality_label: string;
  judet: string;
  area_sqm: number | null;
  price_minor: number;
  currency: string;
  guarantee_minor: number | null;
  auction_at: string;
  issuing_authority: string;
  source_url: string;
  retrieved_at: string;
  withdrawn: boolean;
};