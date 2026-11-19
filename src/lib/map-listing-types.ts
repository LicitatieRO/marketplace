export type MapListingStatus = "scheduled" | "live" | "ended";

export interface MapListing {
  id: string;
  auctionId: string | null;
  slug: string;
  title: string;
  sector: string;
  neighbourhood: string;
  approxLat: number;
  approxLng: number;
  photoUrl: string | null;
  currentBidCents: number;
  minIncrementCents: number;
  startsAt: string | null;
  endsAt: string | null;
  status: MapListingStatus;
  isOwn?: boolean;
  leadingBid?: boolean;
  outbid?: boolean;
  transactionType?: "sale" | "rent";
  rooms?: number;
  propertyType?: string;
}
