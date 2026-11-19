"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Map as LeafletMap } from "leaflet";
import type { MapTileClientConfig } from "@/lib/map-tile-client";
import { isOutsideExtractForLeafletMap } from "@/lib/map-leaflet-extract-coverage";
import { MapOutsideExtractOverlay } from "./map-unavailable";

export function MapExtractBoundsOverlay({
  mapRef,
  mapTileConfig,
  listHref,
  attachRevision = 0,
}: {
  mapRef: RefObject<LeafletMap | null>;
  mapTileConfig: MapTileClientConfig;
  listHref?: string;
  /** Bump when the Leaflet map instance is (re)attached. */
  attachRevision?: number;
}) {
  const [outsideExtract, setOutsideExtract] = useState(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sync = () => {
      setOutsideExtract(isOutsideExtractForLeafletMap(map, mapTileConfig));
    };

    sync();
    map.on("moveend", sync);
    map.on("zoomend", sync);
    return () => {
      map.off("moveend", sync);
      map.off("zoomend", sync);
    };
  }, [mapRef, mapTileConfig, attachRevision]);

  if (!outsideExtract) return null;
  return <MapOutsideExtractOverlay listHref={listHref} />;
}