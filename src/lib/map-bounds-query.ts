export type MapBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

/** Decimal places for bbox query deduplication (matches typical Leaflet move precision). */
export const MAP_BBOX_QUERY_DECIMALS = 4;

function finiteBboxComponent(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Invalid map bounds: ${label}`);
  }
  return value;
}

export function roundBboxComponent(value: number): number {
  const factor = 10 ** MAP_BBOX_QUERY_DECIMALS;
  return Math.round(finiteBboxComponent(value, "component") * factor) / factor;
}

export function normalizeMapBbox(bbox: MapBbox): MapBbox {
  return {
    west: roundBboxComponent(finiteBboxComponent(bbox.west, "west")),
    south: roundBboxComponent(finiteBboxComponent(bbox.south, "south")),
    east: roundBboxComponent(finiteBboxComponent(bbox.east, "east")),
    north: roundBboxComponent(finiteBboxComponent(bbox.north, "north")),
  };
}

export function mapBboxQueryKey(bbox: MapBbox, zoom: number): string {
  const n = normalizeMapBbox(bbox);
  return `${n.west},${n.south},${n.east},${n.north}@${zoom}`;
}

export function mapBboxQueryEquals(
  a: MapBbox,
  b: MapBbox,
  zoomA: number,
  zoomB: number,
): boolean {
  return zoomA === zoomB && mapBboxQueryKey(a, zoomA) === mapBboxQueryKey(b, zoomB);
}

export const MAP_BOUNDS_DEBOUNCE_MS = 300;