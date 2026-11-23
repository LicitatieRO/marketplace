import type { Listing } from "./types";
import type { MapListingStatus } from "./map-listing-types";
import {
  effectiveServerNowMs,
  formatMapTimeLeftParts,
} from "./map-listing-time";

export function deriveListingAuctionStatus(
  listing: Pick<Listing, "auction_id" | "starts_at" | "ends_at">,
  nowMs: number,
): MapListingStatus | null {
  if (!listing.auction_id || !listing.starts_at || !listing.ends_at) return null;
  const starts = Date.parse(listing.starts_at);
  const ends = Date.parse(listing.ends_at);
  if (![starts, ends, nowMs].every(Number.isFinite)) return null;
  if (nowMs >= ends) return "ended";
  if (nowMs < starts) return "scheduled";
  return "live";
}

export function catalogueCardClockOffsetMs(listing: Listing): number {
  const serverMs = Date.parse(listing.server_now || "");
  if (!Number.isFinite(serverMs)) return 0;
  return serverMs - Date.now();
}

export function catalogueCardEffectiveNowMs(
  clientNowMs: number,
  offsetMs: number,
): number {
  return effectiveServerNowMs(clientNowMs, offsetMs);
}

export function catalogueCardTimeParts(
  listing: Pick<Listing, "auction_id" | "starts_at" | "ends_at">,
  nowMs: number,
  language: "ro" | "en",
): { text: string; urgent: boolean } | null {
  const status = deriveListingAuctionStatus(listing, nowMs);
  if (!status || status === "ended") return null;
  if (status === "scheduled") {
    return { text: language === "ro" ? "În curând" : "Starting soon", urgent: false };
  }
  const parts = formatMapTimeLeftParts(listing.ends_at, nowMs, language);
  if (!parts) return null;
  return parts;
}
