"use client";

import { useCallback, useEffect, useState } from "react";
import { ROMANIA_BBOX } from "@/lib/geo-bounds";
import type { MapListing } from "@/lib/map-listing-types";

export type ListingBidViewerFlags = {
  outbid: boolean;
  leadingBid: boolean;
};

const EMPTY: ListingBidViewerFlags = { outbid: false, leadingBid: false };

async function fetchMapListingById(
  listingId: string,
  signal: AbortSignal,
): Promise<MapListing | null> {
  const qs = new URLSearchParams({
    west: String(ROMANIA_BBOX.minLng),
    south: String(ROMANIA_BBOX.minLat),
    east: String(ROMANIA_BBOX.maxLng),
    north: String(ROMANIA_BBOX.maxLat),
  });
  const response = await fetch(`/api/map/listings?${qs.toString()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: MapListing[] };
  return body.data?.find((item) => item.id === listingId) ?? null;
}

export function useListingBidViewerFlags(
  listingId: string,
  enabled: boolean,
): ListingBidViewerFlags & { refresh: () => void } {
  const [flags, setFlags] = useState<ListingBidViewerFlags>(EMPTY);
  const [reloadAt, setReloadAt] = useState(0);
  const refresh = useCallback(() => setReloadAt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const item = await fetchMapListingById(listingId, controller.signal);
        if (!item) {
          queueMicrotask(() => setFlags(EMPTY));
          return;
        }
        queueMicrotask(() =>
          setFlags({
            outbid: item.outbid === true,
            leadingBid: item.leadingBid === true,
          }),
        );
      } catch {
        if (!controller.signal.aborted) {
          queueMicrotask(() => setFlags(EMPTY));
        }
      }
    })();
    return () => controller.abort();
  }, [enabled, listingId, reloadAt]);

  return { ...(enabled ? flags : EMPTY), refresh };
}
