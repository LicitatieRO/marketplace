"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Listing } from "@/lib/types";
import { formatEurCompact } from "@/lib/format-eur-compact";
import { mapPricePillButtonHtml } from "@/lib/map-price-pill-html";
import { ROMANIA_MAP_MAX_BOUNDS } from "@/lib/geo-bounds";
import { attachMapBasemap } from "@/lib/map-leaflet-basemap";
import { BUCHAREST_MAP_CENTER } from "@/lib/map-tiles";
import { usePlatform } from "@/components/platform";
import { MapExtractBoundsOverlay } from "./map-extract-bounds-overlay";
import { pinDisclaimer } from "./map-copy";

export type MapPin = Pick<
  Listing,
  | "id"
  | "title"
  | "neighborhood"
  | "lat"
  | "lng"
  | "transaction_type"
  | "price_minor"
  | "current_bid_minor"
  | "starts_at"
  | "ends_at"
>;

function listingPriceCents(pin: MapPin): number {
  return pin.current_bid_minor ?? pin.price_minor;
}

function listingPillState(pin: MapPin): {
  ended?: boolean;
  scheduled?: boolean;
} {
  const now = Date.now();
  if (pin.ends_at && new Date(pin.ends_at).getTime() < now) {
    return { ended: true };
  }
  if (pin.starts_at && new Date(pin.starts_at).getTime() > now) {
    return { scheduled: true };
  }
  return {};
}

function clearLeafletContainer(el: HTMLElement) {
  const withId = el as HTMLElement & { _leaflet_id?: number };
  if (withId._leaflet_id !== undefined) {
    delete withId._leaflet_id;
  }
  el.replaceChildren();
}

export function PropertyMap({ pins }: { pins: MapPin[] }) {
  const router = useRouter();
  const { language, mapTileConfig } = usePlatform();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapAttachRevision, setMapAttachRevision] = useState(0);
  const plotted = useMemo(
    () =>
      pins.filter(
        (p) =>
          typeof p.lat === "number" &&
          typeof p.lng === "number" &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng),
      ),
    [pins],
  );
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    clearLeafletContainer(container);

    const map = L.map(container, {
      center: BUCHAREST_MAP_CENTER,
      zoom: 12,
      minZoom: 6,
      maxZoom: 17,
      maxBounds: ROMANIA_MAP_MAX_BOUNDS,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    mapRef.current = map;

    let basemapCleanup: (() => void) | undefined;
    let disposed = false;

    void (async () => {
      const attachment = await attachMapBasemap(map, L, mapTileConfig, language, {
        initialBasemap:
          mapTileConfig.provider === "pmtiles" ? "pmtiles" : "osm",
        onBasemapChange: () => {
          if (!disposed) setMapAttachRevision((v) => v + 1);
        },
      });
      if (disposed) {
        attachment.cleanup();
        return;
      }
      basemapCleanup = attachment.cleanup;
      setMapAttachRevision((v) => v + 1);

      for (const pin of plotted) {
        const price = formatEurCompact(listingPriceCents(pin), language);
        const icon = L.divIcon({
          className: "lr-pill-icon",
          html: mapPricePillButtonHtml(
            price,
            pin.id,
            `${pin.neighborhood}, ${price}, ${pin.title}`,
            listingPillState(pin),
          ),
          iconSize: [0, 0],
        });
        const marker = L.marker([pin.lat!, pin.lng!], { icon });
        marker.on("click", () => {
          router.push(`/listings/${pin.id}`);
        });
        marker.addTo(map);
      }

      map.invalidateSize();
    })();

    return () => {
      disposed = true;
      basemapCleanup?.();
      map.remove();
      mapRef.current = null;
      clearLeafletContainer(container);
    };
  }, [plotted, language, mapTileConfig, router]);

  return (
    <div
      data-testid="catalogue-map-interactive"
      style={{ minHeight: 320, position: "relative" }}
    >
      <div
        ref={containerRef}
        data-testid="catalogue-map-leaflet-root"
        style={{ height: 320, width: "100%", borderRadius: 12 }}
      />
      <MapExtractBoundsOverlay
        mapRef={mapRef}
        mapTileConfig={mapTileConfig}
        attachRevision={mapAttachRevision}
      />
    </div>
  );
}

export { pinDisclaimer };
