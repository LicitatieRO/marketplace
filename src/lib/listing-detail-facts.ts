import type { Listing } from "@/lib/types";

/** Map pin for guest-facing property pages: public fuzzed coords only. */
export function listingPublicMapPin(
  listing: Listing,
): { lat: number; lng: number } | null {
  const lat = listing.publicLat ?? listing.lat;
  const lng = listing.publicLng ?? listing.lng;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return { lat, lng };
}

export const listingDocumentQualificationRow = {
  ro: "Documente disponibile după calificare — simulare",
  en: "Documents available after qualification — simulation",
} as const;

export const listingOwnerChannelBullet = {
  ro: "Mesaje și vizionări prin platformă (POC / Simulare)",
  en: "Messages and viewings via the platform (POC / Simulation)",
} as const;

export const listingMapOnAuctionMapLink = {
  ro: "Vezi pe harta licitațiilor",
  en: "View on the auction map",
} as const;