import type { CatalogueMapFilterParams } from "@/lib/catalogue-map-path";

export type MapFilterChip = { id: string; label: string };

export function buildMapFilterChips(
  filters: CatalogueMapFilterParams,
  labels: {
    rent: string;
    rooms: (n: string) => string;
    maxPrice: (n: string) => string;
    neighborhood: (n: string) => string;
    query: (q: string) => string;
    propertyType: (t: string) => string;
  },
): MapFilterChip[] {
  const chips: MapFilterChip[] = [];
  const transaction = filters.transaction?.trim();
  if (transaction === "rent") {
    chips.push({ id: "transaction", label: labels.rent });
  }
  const neighborhood = filters.neighborhood?.trim();
  if (neighborhood) {
    chips.push({ id: "neighborhood", label: labels.neighborhood(neighborhood) });
  }
  const rooms = filters.rooms?.trim();
  if (rooms) {
    chips.push({ id: "rooms", label: labels.rooms(rooms) });
  }
  const maxPrice = filters.maxPrice?.trim();
  if (maxPrice) {
    chips.push({ id: "maxPrice", label: labels.maxPrice(maxPrice) });
  }
  const q = filters.q?.trim();
  if (q) {
    chips.push({ id: "q", label: labels.query(q) });
  }
  const propertyType = filters.propertyType?.trim();
  if (propertyType) {
    chips.push({ id: "propertyType", label: labels.propertyType(propertyType) });
  }
  return chips;
}
