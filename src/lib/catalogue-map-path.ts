/** Query params shared between the homepage catalogue and `/map`. */
export type CatalogueMapFilterParams = {
  transaction?: string;
  q?: string;
  neighborhood?: string;
  maxPrice?: string;
  rooms?: string;
  propertyType?: string;
};

const FILTER_KEYS: (keyof CatalogueMapFilterParams)[] = [
  "transaction",
  "q",
  "neighborhood",
  "maxPrice",
  "rooms",
  "propertyType",
];

export function buildMapPathFromCatalogueFilters(
  filters: CatalogueMapFilterParams,
): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key]?.trim();
    if (!value) continue;
    if (key === "transaction" && value === "sale") continue;
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `/map?${qs}` : "/map";
}

export function parseCatalogueMapFilters(
  searchParams: URLSearchParams,
): CatalogueMapFilterParams {
  const out: CatalogueMapFilterParams = {};
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) out[key] = value;
  }
  return out;
}

export function hasCatalogueMapFilters(
  filters: CatalogueMapFilterParams,
): boolean {
  return FILTER_KEYS.some((key) => {
    const value = filters[key]?.trim();
    if (!value) return false;
    if (key === "transaction" && value === "sale") return false;
    return true;
  });
}
