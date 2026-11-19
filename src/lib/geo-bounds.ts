/**
 * Romania geographic bounds for map panning and property lat/lng validation.
 * Source: OSM relation 90689 (Romania) extent + 0.15° margin.
 */
export const ROMANIA_BBOX = {
  minLng: 20.11,
  minLat: 43.47,
  maxLng: 30.2,
  maxLat: 48.42,
} as const;

/** Leaflet `maxBounds`: south-west then north-east as `[lat, lng]`. */
export const ROMANIA_MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [ROMANIA_BBOX.minLat, ROMANIA_BBOX.minLng],
  [ROMANIA_BBOX.maxLat, ROMANIA_BBOX.maxLng],
];