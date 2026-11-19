/** Bucharest + Ilfov extract bounds (matches `data/tiles/bucharest-ilfov.pmtiles`). */
export const BUCHAREST_ILFOV_BBOX = {
  minLng: 25.52,
  minLat: 44.12,
  maxLng: 26.7,
  maxLat: 44.78,
} as const;

export type BBoxLngLat = typeof BUCHAREST_ILFOV_BBOX;

export type ViewportBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** True when the visible viewport extends outside the offline extract coverage. */
export function viewportOutsideExtractBounds(bounds: ViewportBounds): boolean {
  const b = BUCHAREST_ILFOV_BBOX;
  return (
    bounds.west < b.minLng ||
    bounds.south < b.minLat ||
    bounds.east > b.maxLng ||
    bounds.north > b.maxLat
  );
}