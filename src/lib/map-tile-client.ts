import type { BBoxLngLat } from "@/lib/map-tile-bounds";

export type MapTileProviderMode = "osm" | "pmtiles" | "off";

/** Server-derived map settings exposed to consent-gated client maps. */
export type MapTileClientConfig = {
  provider: MapTileProviderMode;
  pmtilesUrl: string;
  failoverErrorLimit: number;
  failoverWindowMs: number;
  extractMaxZoom: number;
  extractBounds: BBoxLngLat;
};

export function parseMapTileProvider(
  raw: string | undefined,
): MapTileProviderMode {
  const v = raw?.trim().toLowerCase();
  if (v === "pmtiles" || v === "off") return v;
  return "osm";
}

export function parseFailoverErrorLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 5;
  return Math.min(n, 50);
}

export function parseFailoverWindowMs(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1000) return 15_000;
  return Math.min(n, 120_000);
}