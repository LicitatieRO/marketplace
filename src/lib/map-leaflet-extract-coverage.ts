import type { Map as LeafletMap } from "leaflet";
import { viewportOutsideExtractBounds } from "@/lib/map-tile-bounds";
import type { MapTileClientConfig } from "@/lib/map-tile-client";
import { readLeafletBasemapMode } from "@/lib/map-leaflet-basemap";

export function isOutsideExtractForLeafletMap(
  map: LeafletMap,
  config: MapTileClientConfig,
): boolean {
  const basemap = readLeafletBasemapMode(map);
  const onPmtiles = basemap === "pmtiles" || config.provider === "pmtiles";
  if (!onPmtiles) return false;
  const b = map.getBounds();
  return viewportOutsideExtractBounds({
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  });
}