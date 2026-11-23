import { ROMANIA_BBOX } from "@/lib/geo-bounds";
import { roundBboxComponent } from "@/lib/map-bounds-query";

export type ListingsMapView = "list" | "map";

export type ListingsMapBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

const LISTING_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const MAP_VIEW_VALUES = new Set<ListingsMapView>(["list", "map"]);

function clampBboxComponent(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function parseListingsMapListingId(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 64) return null;
  if (!LISTING_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function parseListingsMapView(params: URLSearchParams): ListingsMapView {
  const view = params.get("view");
  if (view === "map") return "map";
  if (view === "list") return "list";
  return "list";
}

export function listingsMapUrlParamsFromRecord(
  record: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
      continue;
    }
    params.set(key, value);
  }
  return params;
}

export function parseListingsMapBboxParam(
  raw: string | null,
  fallback: ListingsMapBbox,
): ListingsMapBbox {
  if (!raw) return fallback;
  const parts = raw.split(",");
  if (parts.length !== 4) return fallback;
  const nums = parts.map((part) => Number(part.trim()));
  if (nums.some((n) => !Number.isFinite(n))) return fallback;
  let [west, south, east, north] = nums;
  west = clampBboxComponent(west, ROMANIA_BBOX.minLng, ROMANIA_BBOX.maxLng);
  east = clampBboxComponent(east, ROMANIA_BBOX.minLng, ROMANIA_BBOX.maxLng);
  south = clampBboxComponent(south, ROMANIA_BBOX.minLat, ROMANIA_BBOX.maxLat);
  north = clampBboxComponent(north, ROMANIA_BBOX.minLat, ROMANIA_BBOX.maxLat);
  if (west >= east || south >= north) return fallback;
  return {
    west: roundBboxComponent(west),
    south: roundBboxComponent(south),
    east: roundBboxComponent(east),
    north: roundBboxComponent(north),
  };
}

export function listingsMapSearchParams(input: {
  listingId: string | null;
  bbox: ListingsMapBbox;
  mobileView: ListingsMapView;
  existing?: URLSearchParams;
}): URLSearchParams {
  const params = new URLSearchParams(input.existing ?? undefined);
  const safeListing = parseListingsMapListingId(input.listingId);
  if (safeListing) {
    params.set("listing", safeListing);
  } else {
    params.delete("listing");
  }
  const safeBbox = parseListingsMapBboxParam(
    [
      input.bbox.west,
      input.bbox.south,
      input.bbox.east,
      input.bbox.north,
    ].join(","),
    input.bbox,
  );
  params.set(
    "bbox",
    [
      safeBbox.west,
      safeBbox.south,
      safeBbox.east,
      safeBbox.north,
    ].join(","),
  );
  if (MAP_VIEW_VALUES.has(input.mobileView) && input.mobileView === "map") {
    params.set("view", "map");
  } else {
    params.delete("view");
  }
  return params;
}
