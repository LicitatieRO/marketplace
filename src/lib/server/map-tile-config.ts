import "server-only";
import { BUCHAREST_ILFOV_BBOX, type BBoxLngLat } from "@/lib/map-tile-bounds";
import {
  type MapTileClientConfig,
  parseFailoverErrorLimit,
  parseFailoverWindowMs,
  parseMapTileProvider,
} from "@/lib/map-tile-client";
import { DEFAULT_PMTILES_PUBLIC_PATH } from "@/lib/map-tiles";

export const PMTILES_EXTRACT_MAX_ZOOM = 15;

export function getMapTileClientConfig(): MapTileClientConfig {
  return {
    provider: parseMapTileProvider(process.env.MAP_TILE_PROVIDER),
    pmtilesUrl: DEFAULT_PMTILES_PUBLIC_PATH,
    failoverErrorLimit: parseFailoverErrorLimit(
      process.env.MAP_TILE_FAILOVER_ERRORS,
    ),
    failoverWindowMs: parseFailoverWindowMs(
      process.env.MAP_TILE_FAILOVER_WINDOW_MS,
    ),
    extractMaxZoom: PMTILES_EXTRACT_MAX_ZOOM,
    extractBounds: BUCHAREST_ILFOV_BBOX as BBoxLngLat,
  };
}