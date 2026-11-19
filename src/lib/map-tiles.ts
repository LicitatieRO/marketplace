/** Default OSM raster tiles (no {s} subdomains — OSMF policy). */
export const DEFAULT_MAP_TILE_URL =
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

export const OSM_FIX_THE_MAP_URL = "https://www.openstreetmap.org/fixthemap";

export const DEFAULT_MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Self-hosted PMTiles extract (same-origin static asset; HTTP range reads). */
export const DEFAULT_PMTILES_PUBLIC_PATH = "/tiles/bucharest-ilfov.pmtiles";

export const PMTILES_FALLBACK_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ODbL · <a href="https://protomaps.com">Protomaps</a>';

/**
 * Allowed tile CDN hostnames for NEXT_PUBLIC_MAP_TILE_URL overrides (https only).
 * Add new hosts here and in docs/third-parties.md when approving another tile provider.
 */
export const MAP_TILE_HOST_ALLOWLIST = [
  "tile.openstreetmap.org",
] as const;

/** @deprecated Use DEFAULT_MAP_TILE_URL */
export const DEFAULT_OSM_TILE_URL = DEFAULT_MAP_TILE_URL;

function sampleTileUrl(template: string): string {
  return template.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0");
}

export function isAllowedMapTileTemplate(template: string): boolean {
  if (!template.includes("{z}") || template.includes("{s}")) {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(sampleTileUrl(template));
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return (MAP_TILE_HOST_ALLOWLIST as readonly string[]).includes(parsed.hostname);
}

export function mapTileAttributionIncludesOsmCredit(attribution: string): boolean {
  const lower = attribution.toLowerCase();
  return (
    lower.includes("openstreetmap.org/copyright") &&
    lower.includes("openstreetmap")
  );
}

export function mapTileUrlTemplate(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MAP_TILE_URL?.trim();
  if (fromEnv && isAllowedMapTileTemplate(fromEnv)) {
    return fromEnv;
  }
  const legacy = process.env.NEXT_PUBLIC_OSM_TILE_URL?.trim();
  if (legacy && isAllowedMapTileTemplate(legacy)) {
    return legacy;
  }
  return DEFAULT_MAP_TILE_URL;
}

/** @deprecated Use mapTileUrlTemplate */
export const osmTileUrlTemplate = mapTileUrlTemplate;

export function mapTileAttribution(): string {
  const fromEnv = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim();
  if (
    fromEnv &&
    fromEnv.length > 0 &&
    mapTileAttributionIncludesOsmCredit(fromEnv)
  ) {
    return fromEnv;
  }
  return DEFAULT_MAP_TILE_ATTRIBUTION;
}

export function resolveMapSurface(
  allowsOptionalContent: boolean,
  provider: "osm" | "pmtiles" | "off" = "osm",
): "placeholder" | "interactive" | "unavailable" {
  if (provider === "off") return "unavailable";
  return allowsOptionalContent ? "interactive" : "placeholder";
}

export function isAllowedPmtilesAssetUrl(url: string): boolean {
  if (url === DEFAULT_PMTILES_PUBLIC_PATH) return true;
  try {
    const parsed = new URL(url, "https://example.invalid");
    return parsed.pathname === DEFAULT_PMTILES_PUBLIC_PATH;
  } catch {
    return false;
  }
}

export function mapTileAttributionForBasemap(
  basemap: "osm" | "pmtiles",
): string {
  return basemap === "pmtiles"
    ? PMTILES_FALLBACK_ATTRIBUTION
    : mapTileAttribution();
}

export const BUCHAREST_MAP_CENTER: [number, number] = [44.4325, 26.1039];