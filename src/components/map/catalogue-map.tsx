"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { Listing } from "@/lib/types";
import {
  OPTIONAL_CONTENT_STORAGE_KEY,
  type OptionalContentChoice,
} from "@/lib/optional-content";
import {
  notifyOptionalContentChanged,
} from "@/lib/optional-content-events";
import { useAllowsOptionalContent } from "@/components/disclosures/cookie-consent-banner";
import { usePlatform } from "@/components/platform";
import { resolveMapSurface } from "@/lib/map-tiles";
import { OSM_FIX_THE_MAP_URL } from "@/lib/map-tiles";
import { mapThirdPartyConsent, pinDisclaimer, reportMapIssue } from "./map-copy";
import { MapGloballyUnavailable } from "./map-unavailable";
import { PropertyMap, type MapPin } from "./property-map";

function publicPinCoords(
  item: Listing,
): { lat: number; lng: number } | null {
  const lat = item.publicLat ?? item.lat;
  const lng = item.publicLng ?? item.lng;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return { lat, lng };
}

function uniquePropertyPins(listings: Listing[]): MapPin[] {
  const seen = new Set<string>();
  const out: MapPin[] = [];
  for (const item of listings) {
    if (seen.has(item.property_id)) continue;
    const coords = publicPinCoords(item);
    if (!coords) continue;
    seen.add(item.property_id);
    out.push({
      id: item.id,
      title: item.title,
      neighborhood: item.neighborhood,
      lat: coords.lat,
      lng: coords.lng,
      transaction_type: item.transaction_type,
      price_minor: item.price_minor,
      current_bid_minor: item.current_bid_minor,
      starts_at: item.starts_at,
      ends_at: item.ends_at,
    });
  }
  return out;
}

export function CatalogueMap({
  listings,
  mapHref = "/map",
}: {
  listings: Listing[];
  mapHref?: string;
}) {
  const { t, mapTileConfig } = usePlatform();
  const globalAllows = useAllowsOptionalContent();
  const [localAccepted, setLocalAccepted] = useState(false);
  const allowsTiles = globalAllows || localAccepted;
  const surface = resolveMapSurface(allowsTiles, mapTileConfig.provider);
  const pins = uniquePropertyPins(listings);
  const disclaimer = t(pinDisclaimer.ro, pinDisclaimer.en);

  const acceptMap = useCallback(() => {
    setLocalAccepted(true);
    if (!globalAllows) {
      const choice: OptionalContentChoice = "accepted";
      localStorage.setItem(OPTIONAL_CONTENT_STORAGE_KEY, choice);
      notifyOptionalContentChanged();
    }
  }, [globalAllows]);

  if (surface === "unavailable") {
    return (
      <section
        className="page-width"
        style={{ marginBottom: 24 }}
        aria-label={t("Hartă catalog", "Catalogue map")}
        data-testid="catalogue-map-unavailable"
      >
        <MapGloballyUnavailable />
      </section>
    );
  }

  if (surface === "placeholder") {
    return (
      <section
        className="page-width"
        style={{ marginBottom: 24 }}
        aria-label={t("Hartă catalog", "Catalogue map")}
        data-testid="catalogue-map-placeholder"
      >
        <div className="feedback notice" style={{ padding: 16 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>
            {t(mapThirdPartyConsent.titleRo, mapThirdPartyConsent.titleEn)}
          </p>
          <p className="muted small" style={{ marginBottom: 12 }}>
            {t(mapThirdPartyConsent.bodyRo, mapThirdPartyConsent.bodyEn)}
          </p>
          <p className="muted small" style={{ marginBottom: 12 }}>
            {disclaimer}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="button primary"
              data-testid="catalogue-map-accept"
              onClick={acceptMap}
            >
              {t(mapThirdPartyConsent.acceptRo, mapThirdPartyConsent.acceptEn)}
            </button>
            <Link href="#catalogue-listings" className="button">
              {t(mapThirdPartyConsent.declineRo, mapThirdPartyConsent.declineEn)}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="page-width"
      style={{ marginBottom: 24 }}
      aria-label={t("Hartă catalog", "Catalogue map")}
    >
      <p
        className="muted small"
        style={{
          marginBottom: 8,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
        }}
      >
        <Link
          href={mapHref}
          className="text-link"
          data-testid="catalogue-map-open-full"
        >
          {t("Deschide harta completă", "Open full map")}
          {" →"}
        </Link>
      </p>
      <p className="muted small" style={{ marginBottom: 8 }}>
        {disclaimer}
      </p>
      <p className="muted small" style={{ marginBottom: 8 }}>
        <a
          href={OSM_FIX_THE_MAP_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="catalogue-map-report-issue"
        >
          {t(reportMapIssue.ro, reportMapIssue.en)}
        </a>
      </p>
      <PropertyMap pins={pins} />
    </section>
  );
}
