"use client";

import type { Layer, Map as LeafletMap } from "leaflet";
import type { MapTileClientConfig } from "@/lib/map-tile-client";
import { MapTileFailoverCounter } from "@/lib/map-tile-failover";
import {
  isAllowedPmtilesAssetUrl,
  mapTileAttribution,
  mapTileAttributionForBasemap,
  mapTileUrlTemplate,
} from "@/lib/map-tiles";

export type ActiveBasemap = "osm" | "pmtiles";

export type BasemapAttachment = {
  getActiveBasemap: () => ActiveBasemap;
  cleanup: () => void;
};

const DATASET_BASEMAP_KEY = "lrBasemap";

export function markLeafletBasemapMode(map: LeafletMap, mode: ActiveBasemap): void {
  map.getContainer().dataset[DATASET_BASEMAP_KEY] = mode;
}

export function readLeafletBasemapMode(map: LeafletMap): ActiveBasemap {
  const value = map.getContainer().dataset[DATASET_BASEMAP_KEY];
  return value === "pmtiles" ? "pmtiles" : "osm";
}

async function attachPmtilesBasemap(
  map: LeafletMap,
  L: typeof import("leaflet"),
  config: MapTileClientConfig,
  language: "ro" | "en",
): Promise<Layer> {
  if (!isAllowedPmtilesAssetUrl(config.pmtilesUrl)) {
    throw new Error("PMTiles URL is not allowlisted");
  }
  const { leafletLayer } = await import("protomaps-leaflet");
  const layer = leafletLayer({
    url: config.pmtilesUrl,
    flavor: "light",
    lang: language === "ro" ? "ro" : "en",
    attribution: mapTileAttributionForBasemap("pmtiles"),
    keepBuffer: 1,
    updateWhenIdle: true,
    maxNativeZoom: config.extractMaxZoom,
  });
  layer.addTo(map);
  return layer as unknown as Layer;
}

/** Consent-gated Leaflet basemap: OSM raster with optional dormant PMTiles failover. */
export async function attachMapBasemap(
  map: LeafletMap,
  L: typeof import("leaflet"),
  config: MapTileClientConfig,
  language: "ro" | "en",
  options: {
    initialBasemap: ActiveBasemap;
    onBasemapChange?: (mode: ActiveBasemap) => void;
  },
): Promise<BasemapAttachment> {
  let activeBasemap = options.initialBasemap;
  let basemapLayer: Layer | undefined;
  markLeafletBasemapMode(map, activeBasemap);

  const removeBasemap = () => {
    if (basemapLayer) {
      map.removeLayer(basemapLayer);
      basemapLayer = undefined;
    }
  };

  const notifyBasemap = (mode: ActiveBasemap) => {
    activeBasemap = mode;
    markLeafletBasemapMode(map, mode);
    options.onBasemapChange?.(mode);
  };

  const switchToPmtiles = async () => {
    if (activeBasemap === "pmtiles") return;
    removeBasemap();
    basemapLayer = await attachPmtilesBasemap(map, L, config, language);
    notifyBasemap("pmtiles");
  };

  if (options.initialBasemap === "pmtiles") {
    basemapLayer = await attachPmtilesBasemap(map, L, config, language);
    return {
      getActiveBasemap: () => activeBasemap,
      cleanup: removeBasemap,
    };
  }

  const osmLayer = L.tileLayer(mapTileUrlTemplate(), {
    attribution: mapTileAttribution(),
    referrerPolicy: "strict-origin-when-cross-origin",
    keepBuffer: 1,
    updateWhenIdle: true,
  });

  if (config.provider === "osm") {
    const counter = new MapTileFailoverCounter(
      config.failoverErrorLimit,
      config.failoverWindowMs,
    );
    osmLayer.on("tileerror", () => {
      const { shouldFailover } = counter.recordTileLoadError();
      if (shouldFailover) {
        void switchToPmtiles();
      }
    });
  }

  osmLayer.addTo(map);
  basemapLayer = osmLayer;

  return {
    getActiveBasemap: () => activeBasemap,
    cleanup: removeBasemap,
  };
}