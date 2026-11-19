import type { Listing, TransactionType } from "@/lib/types";

export type MapListingFilterMeta = {
  transaction_type: TransactionType;
  rooms: number;
  property_type: string;
  neighborhood: string;
};

export function buildMapListingFilterMeta(
  catalogueListings: Listing[],
): Map<string, MapListingFilterMeta> {
  const out = new Map<string, MapListingFilterMeta>();
  for (const item of catalogueListings) {
    out.set(item.id, {
      transaction_type: item.transaction_type,
      rooms: item.rooms,
      property_type: item.property_type,
      neighborhood: item.neighborhood,
    });
  }
  return out;
}

export function catalogueNeighborhoodsFromListings(
  catalogueListings: Listing[],
): Set<string> {
  return new Set(catalogueListings.map((item) => item.neighborhood));
}
