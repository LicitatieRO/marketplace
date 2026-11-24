"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { Listing } from "@/lib/types";
import {
  OPTIONAL_CONTENT_STORAGE_KEY,
  type OptionalContentChoice,
} from "@/lib/optional-content";
import { notifyOptionalContentChanged } from "@/lib/optional-content-events";
import { useAllowsOptionalContent } from "@/components/disclosures/cookie-consent-banner";
import { usePlatform } from "@/components/platform";
import { resolveMapSurface } from "@/lib/map-tiles";
import { listingMapOnAuctionMapLink, listingPublicMapPin } from "@/lib/listing-detail-facts";
import { mapThirdPartyConsent, pinDisclaimer } from "./map-copy";
import { MapGloballyUnavailable } from "./map-unavailable";
import type { MapPin } from "./property-map";

const PropertyMap = dynamic(
  () =>
    import("./property-map").then((m) => ({
      default: m.PropertyMap,
    })),
  { ssr: false },
);

export function ListingDetailMap({ listing }: { listing: Listing }) {
  const { t, mapTileConfig } = usePlatform();
  const globalAllows = useAllowsOptionalContent();
  const [localAccepted, setLocalAccepted] = useState(false);
  const allowsTiles = globalAllows || localAccepted;
  const surface = resolveMapSurface(allowsTiles, mapTileConfig.provider);
  const mapHref = `/map?listing=${listing.id}`;
  const disclaimer = t(pinDisclaimer.ro, pinDisclaimer.en);
  const coords = listingPublicMapPin(listing);

  const pins = useMemo((): MapPin[] => {
    if (!coords) return [];
    return [
      {
        id: listing.id,
        title: listing.title,
        neighborhood: listing.neighborhood,
        lat: coords.lat,
        lng: coords.lng,
        transaction_type: listing.transaction_type,
        price_minor: listing.price_minor,
        current_bid_minor: listing.current_bid_minor,
        starts_at: listing.starts_at,
        ends_at: listing.ends_at,
      },
    ];
  }, [coords, listing]);

  const acceptMap = useCallback(() => {
    setLocalAccepted(true);
    if (!globalAllows) {
      const choice: OptionalContentChoice = "accepted";
      localStorage.setItem(OPTIONAL_CONTENT_STORAGE_KEY, choice);
      notifyOptionalContentChanged();
    }
  }, [globalAllows]);

  const mapVisual = (() => {
    if (surface === "unavailable") {
      return (
        <div data-testid="listing-detail-map-unavailable">
          <MapGloballyUnavailable />
        </div>
      );
    }
    if (surface === "placeholder") {
      return (
        <div
          className="listing-detail-map-placeholder"
          data-testid="listing-detail-map-placeholder"
        >
          <p className="muted small" style={{ marginBottom: 8 }}>
            {t(mapThirdPartyConsent.bodyRo, mapThirdPartyConsent.bodyEn)}
          </p>
          <p className="muted small" style={{ marginBottom: 12 }}>
            {disclaimer}
          </p>
          <button
            type="button"
            className="button primary"
            data-testid="listing-detail-map-accept"
            onClick={acceptMap}
          >
            {t(mapThirdPartyConsent.acceptRo, mapThirdPartyConsent.acceptEn)}
          </button>
        </div>
      );
    }
    if (pins.length === 0) {
      return (
        <p className="muted small" data-testid="listing-detail-map-no-coords">
          {t(
            "Harta aproximativă indisponibilă pentru acest anunț.",
            "Approximate map unavailable for this listing.",
          )}
        </p>
      );
    }
    return (
      <div data-testid="listing-detail-map-interactive">
        <PropertyMap pins={pins} />
      </div>
    );
  })();

  return (
    <div className="listing-detail-map-visual" data-testid="listing-detail-map">
      {mapVisual}
      <p className="muted small" style={{ marginTop: 8 }}>
        <Link href={mapHref} className="text-link" data-testid="listing-detail-map-link">
          {t(
            listingMapOnAuctionMapLink.ro,
            listingMapOnAuctionMapLink.en,
          )}
        </Link>
      </p>
    </div>
  );
}