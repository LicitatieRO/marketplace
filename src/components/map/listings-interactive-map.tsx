"use client";

import { useEffect, useRef, useState } from "react";
import type { MapListing } from "@/lib/map-listing-types";
import type { Language } from "@/lib/types";
import { formatEurCompact } from "@/lib/format-eur-compact";
import {
  effectiveServerNowMs,
  formatMapClusterAriaLabel,
  formatMapPillAriaLabel,
} from "@/lib/map-listing-time";
import { buildMapClusterMarkerHtml } from "@/lib/map-marker-html";
import { mapPricePillButtonHtml } from "@/lib/map-price-pill-html";
import { ROMANIA_MAP_MAX_BOUNDS } from "@/lib/geo-bounds";
import {
  MAP_BOUNDS_DEBOUNCE_MS,
  mapBboxQueryKey,
  type MapBbox,
} from "@/lib/map-bounds-query";
import { attachMapBasemap } from "@/lib/map-leaflet-basemap";
import { BUCHAREST_MAP_CENTER } from "@/lib/map-tiles";
import { usePlatform } from "@/components/platform";
import { MapExtractBoundsOverlay } from "./map-extract-bounds-overlay";

const LISTINGS_MAP_INITIAL_ZOOM = 11;

type Leaflet = typeof import("leaflet");
type MarkerClusterGroup = import("leaflet").LayerGroup & {
  clearLayers: () => void;
  addLayer: (layer: import("leaflet").Layer) => void;
};

function buildListingMarkers(
  L: Leaflet,
  cluster: MarkerClusterGroup,
  listings: MapListing[],
  selectedId: string | null,
  highlightedId: string | null,
  language: Language,
  serverClockOffsetMs: number,
  onSelect: (id: string) => void,
) {
  cluster.clearLayers();
  const nowMs = effectiveServerNowMs(Date.now(), serverClockOffsetMs);
  for (const item of listings) {
    const price = formatEurCompact(item.currentBidCents, language);
    const selected = item.id === selectedId;
    const highlighted = item.id === highlightedId;
    const ended = item.status === "ended";
    const scheduled = item.status === "scheduled";
    const own = item.isOwn === true;
    const ariaLabel = formatMapPillAriaLabel(
      item.neighbourhood,
      item.currentBidCents,
      item.status,
      item.startsAt,
      item.endsAt,
      nowMs,
      language,
    );
    const pillHtml = mapPricePillButtonHtml(price, item.id, ariaLabel, {
      selected,
      highlighted,
      ended,
      scheduled,
      own,
      outbid: item.outbid === true,
    });
    const icon = L.divIcon({
      className: "lr-pill-icon",
      html: pillHtml,
      iconSize: [0, 0],
    });
    const marker = L.marker([item.approxLat, item.approxLng], { icon });
    marker.on("click", () => onSelect(item.id));
    cluster.addLayer(marker);
  }
}

export function ListingsInteractiveMap({
  listings,
  selectedId,
  highlightedId,
  serverClockOffsetMs,
  onSelect,
  onBoundsChange,
}: {
  listings: MapListing[];
  selectedId: string | null;
  highlightedId: string | null;
  serverClockOffsetMs: number;
  onSelect: (id: string) => void;
  onBoundsChange?: (bounds: MapBbox) => void;
}) {
  const { language, mapTileConfig } = usePlatform();
  const rootRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const clusterRef = useRef<MarkerClusterGroup | null>(null);
  const initStartedRef = useRef(false);
  const lastBoundsKeyRef = useRef("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSelectRef = useRef(onSelect);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const languageRef = useRef(language);
  const serverClockOffsetRef = useRef(serverClockOffsetMs);
  const [mapReady, setMapReady] = useState(false);
  const [basemapRevision, setBasemapRevision] = useState(0);
  const [boundsSettledRevision, setBoundsSettledRevision] = useState(0);
  const [mapZoom, setMapZoom] = useState(LISTINGS_MAP_INITIAL_ZOOM);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onBoundsChangeRef.current = onBoundsChange;
    languageRef.current = language;
    serverClockOffsetRef.current = serverClockOffsetMs;
  }, [onSelect, onBoundsChange, language, serverClockOffsetMs]);

  useEffect(() => {
    if (initStartedRef.current) return;
    const root = rootRef.current;
    if (!root) return;
    initStartedRef.current = true;

    let disposed = false;
    let basemapCleanup: (() => void) | undefined;
    let unbindBounds: (() => void) | undefined;

    void (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      await import("leaflet.markercluster");
      await import("leaflet.markercluster/dist/MarkerCluster.css");
      await import("leaflet.markercluster/dist/MarkerCluster.Default.css");
      if (disposed) return;

      const map = L.map(root, {
        center: BUCHAREST_MAP_CENTER,
        zoom: LISTINGS_MAP_INITIAL_ZOOM,
        minZoom: 6,
        maxZoom: 17,
        maxBounds: ROMANIA_MAP_MAX_BOUNDS,
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      const attachment = await attachMapBasemap(map, L, mapTileConfig, language, {
        initialBasemap:
          mapTileConfig.provider === "pmtiles" ? "pmtiles" : "osm",
        onBasemapChange: () => {
          if (!disposed) setBasemapRevision((v) => v + 1);
        },
      });
      if (disposed) {
        attachment.cleanup();
        return;
      }
      basemapCleanup = attachment.cleanup;
      if (!disposed) setBasemapRevision((v) => v + 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cluster = (L as any).markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: (group: { getChildCount: () => number }) => {
          const count = group.getChildCount();
          const size = count < 10 ? 36 : count < 100 ? 44 : 52;
          const ariaLabel = formatMapClusterAriaLabel(
            count,
            languageRef.current,
          );
          return L.divIcon({
            html: buildMapClusterMarkerHtml(count, ariaLabel),
            className: "lr-cluster-wrap",
            iconSize: [size, size],
          });
        },
      }) as MarkerClusterGroup;
      clusterRef.current = cluster;
      map.addLayer(cluster);

      buildListingMarkers(
        L,
        cluster,
        listings,
        selectedId,
        highlightedId,
        language,
        serverClockOffsetRef.current,
        (id) => onSelectRef.current(id),
      );

      const scheduleBounds = () => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          debounceTimerRef.current = null;
          if (disposed) return;
          const bounds = map.getBounds();
          const zoom = map.getZoom();
          const payload: MapBbox = {
            west: bounds.getWest(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            north: bounds.getNorth(),
          };
          const key = mapBboxQueryKey(payload, zoom);
          if (key !== lastBoundsKeyRef.current) {
            lastBoundsKeyRef.current = key;
            onBoundsChangeRef.current?.(payload);
          }
          if (!disposed) {
            setMapZoom(zoom);
            setBoundsSettledRevision((revision) => revision + 1);
          }
        }, MAP_BOUNDS_DEBOUNCE_MS);
      };

      const onMoveEnd = () => scheduleBounds();
      const onZoomEnd = () => scheduleBounds();
      map.on("moveend", onMoveEnd);
      map.on("zoomend", onZoomEnd);
      unbindBounds = () => {
        map.off("moveend", onMoveEnd);
        map.off("zoomend", onZoomEnd);
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
      };

      map.invalidateSize();
      scheduleBounds();
      if (!disposed) setMapReady(true);
    })();

    return () => {
      disposed = true;
      basemapCleanup?.();
      unbindBounds?.();
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current = null;
      initStartedRef.current = false;
      lastBoundsKeyRef.current = "";
      setMapReady(false);
      setBasemapRevision(0);
      setBoundsSettledRevision(0);
    };
    // Leaflet map is created once per mount — props sync in separate effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const root = rootRef.current;
    if (!map || !root) return;

    const resize = () => {
      map.invalidateSize();
    };
    resize();
    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady) return;
    const cluster = clusterRef.current;
    if (!cluster) return;

    void (async () => {
      const L = (await import("leaflet")).default;
      buildListingMarkers(
        L,
        cluster,
        listings,
        selectedId,
        highlightedId,
        language,
        serverClockOffsetMs,
        (id) => onSelectRef.current(id),
      );
    })();
  }, [
    mapReady,
    listings,
    selectedId,
    highlightedId,
    language,
    serverClockOffsetMs,
  ]);

  return (
    <div
      className="listings-map-interactive-shell"
      data-testid="listings-map-interactive"
      data-map-bounds-settled-revision={boundsSettledRevision}
      data-map-zoom={mapZoom}
      data-map-min-zoom={6}
    >
      <div ref={rootRef} className="listings-map-canvas" />
      <MapExtractBoundsOverlay
        mapRef={mapRef}
        mapTileConfig={mapTileConfig}
        listHref="#map-list-panel"
        attachRevision={mapReady ? basemapRevision : 0}
      />
    </div>
  );
}