import type { MapListing } from "@/lib/map-listing-types";
import type { CatalogueMapFilterParams } from "@/lib/catalogue-map-path";
import type { MapListingFilterMeta } from "@/lib/map-listing-filter-meta";

export function applyCatalogueFiltersToMapListings(
  listings: MapListing[],
  filters: CatalogueMapFilterParams,
  metaByListingId?: Map<string, MapListingFilterMeta>,
): MapListing[] {
  const q = filters.q?.trim().toLocaleLowerCase();
  const neighborhood = filters.neighborhood?.trim();
  const maxPriceMajor = filters.maxPrice ? Number(filters.maxPrice) : NaN;
  const maxPriceCents = Number.isFinite(maxPriceMajor)
    ? maxPriceMajor * 100
    : null;
  const transaction = filters.transaction?.trim();
  const minRooms = filters.rooms ? Number(filters.rooms) : NaN;
  const propertyType = filters.propertyType?.trim();

  return listings.filter((item) => {
    const meta = metaByListingId?.get(item.id);
    const itemTransaction =
      meta?.transaction_type ?? item.transactionType ?? "sale";
    const itemRooms = meta?.rooms ?? item.rooms;
    const itemPropertyType = meta?.property_type ?? item.propertyType;
    const itemNeighbourhood = item.neighbourhood;

    if (q) {
      const haystack = `${item.title} ${itemNeighbourhood}`.toLocaleLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (neighborhood && itemNeighbourhood !== neighborhood) return false;
    if (maxPriceCents !== null && item.currentBidCents > maxPriceCents) {
      return false;
    }
    if (transaction && itemTransaction !== transaction) return false;
    if (Number.isFinite(minRooms)) {
      if (typeof itemRooms !== "number" || itemRooms < minRooms) return false;
    }
    if (propertyType && itemPropertyType !== propertyType) return false;
    return true;
  });
}
