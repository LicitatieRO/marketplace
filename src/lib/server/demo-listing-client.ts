import type { Listing } from "@/lib/types";

/** Demo fallback: never send exact property coordinates to the browser. */
export function sanitizeDemoListingForClient(listing: Listing): Listing {
  const { lat: _exactLat, lng: _exactLng, publicLat, publicLng, ...rest } =
    listing;
  void _exactLat;
  void _exactLng;
  const approxLat = typeof publicLat === "number" ? publicLat : undefined;
  const approxLng = typeof publicLng === "number" ? publicLng : undefined;
  if (approxLat === undefined || approxLng === undefined) {
    return { ...rest };
  }
  return { ...rest, publicLat: approxLat, publicLng: approxLng };
}

export function sanitizeDemoListingsForClient(listings: Listing[]): Listing[] {
  return listings.map(sanitizeDemoListingForClient);
}
