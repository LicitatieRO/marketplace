"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { MapListing } from "@/lib/map-listing-types";
import { resolveMapSurface } from "@/lib/map-tiles";
import { usePlatform } from "@/components/platform";
import { mapThirdPartyConsent } from "./map-copy";
import { MapGloballyUnavailable } from "./map-unavailable";

const ListingsInteractiveMap = dynamic(
  () =>
    import("./listings-interactive-map").then((m) => ({
      default: m.ListingsInteractiveMap,
    })),
  { ssr: false },
);

export function ListingsMapCanvas({
  allowsTiles,
  showOnLayout,
  listings,
  selectedId,
  highlightedId,
  onSelect,
  onBoundsChange,
  onAcceptMap,
  serverClockOffsetMs,
}: {
  allowsTiles: boolean;
  showOnLayout: boolean;
  listings: MapListing[];
  selectedId: string | null;
  highlightedId: string | null;
  serverClockOffsetMs: number;
  onSelect: (id: string) => void;
  onBoundsChange: (bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  }) => void;
  onAcceptMap: () => void;
}) {
  const { t, mapTileConfig } = usePlatform();
  const mapProviderSurface = resolveMapSurface(
    allowsTiles,
    mapTileConfig.provider,
  );
  const showInteractiveMap =
    mapProviderSurface === "interactive" && showOnLayout;

  if (mapProviderSurface === "unavailable") {
    return <MapGloballyUnavailable />;
  }

  if (
    mapProviderSurface === "interactive" &&
    allowsTiles &&
    !showOnLayout
  ) {
    return (
      <p className="muted small listings-map-layout-hint" data-testid="listings-map-layout-hint">
        {t(
          "Apasă „Hartă” pentru a vedea licitațiile pe hartă.",
          "Tap “Map” to view listings on the map.",
        )}
      </p>
    );
  }

  if (showInteractiveMap) {
    return (
      <ListingsInteractiveMap
        listings={listings}
        selectedId={selectedId}
        highlightedId={highlightedId}
        serverClockOffsetMs={serverClockOffsetMs}
        onSelect={onSelect}
        onBoundsChange={onBoundsChange}
      />
    );
  }

  return (
    <div className="feedback notice" data-testid="listings-map-placeholder">
      <p>{t(mapThirdPartyConsent.titleRo, mapThirdPartyConsent.titleEn)}</p>
      <p className="muted small">
        {t(mapThirdPartyConsent.bodyRo, mapThirdPartyConsent.bodyEn)}
      </p>
      <button
        type="button"
        className="button primary"
        data-testid="listings-map-accept"
        data-tour="map-consent-accept"
        onClick={onAcceptMap}
      >
        {t(mapThirdPartyConsent.acceptRo, mapThirdPartyConsent.acceptEn)}
      </button>
      <Link href="/legal/privacy#maps" className="button">
        {t("Detalii", "Details")}
      </Link>
    </div>
  );
}
