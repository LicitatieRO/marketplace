"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Listing } from "@/lib/types";
import { formatEurCompact } from "@/lib/format-eur-compact";
import { bidGlossary } from "@/lib/bid-copy";
import {
  catalogueCardClockOffsetMs,
  catalogueCardEffectiveNowMs,
  catalogueCardTimeParts,
  deriveListingAuctionStatus,
} from "@/lib/catalogue-card-clock";
import { usePlatform } from "./platform";

export function CatalogueCardAuctionMeta({ listing }: { listing: Listing }) {
  const { language } = usePlatform();
  const glossary = bidGlossary(language);
  const offsetMs = useMemo(() => catalogueCardClockOffsetMs(listing), [listing]);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [clientNowMs, setClientNowMs] = useState(0);

  useEffect(() => {
    if (!mounted) return;
    const update = () => setClientNowMs(Date.now());
    update();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) return;
    const tick = window.setInterval(update, 1000);
    return () => window.clearInterval(tick);
  }, [listing.id, listing.ends_at, listing.server_now, mounted]);

  if (
    !mounted ||
    clientNowMs === 0 ||
    listing.auction_mode !== "ascending" ||
    !listing.auction_id
  ) {
    return null;
  }

  const nowMs = catalogueCardEffectiveNowMs(clientNowMs, offsetMs);
  const status = deriveListingAuctionStatus(listing, nowMs);
  if (status === "ended") return null;

  const bidCents =
    listing.current_bid_minor ??
    listing.starting_price_minor ??
    listing.price_minor;
  const timeParts = catalogueCardTimeParts(listing, nowMs, language);

  return (
    <div
      className="card-auction-meta"
      data-testid="catalogue-card-auction-meta"
      suppressHydrationWarning
    >
      <span>
        {glossary.currentOffer}{" "}
        <strong>{formatEurCompact(bidCents, language)}</strong>
      </span>
      <span className="chip poc">POC</span>
      <span className="muted">
        · {glossary.offersRecorded(listing.bid_count)}
      </span>
      {timeParts ? (
        <span
          className={`card-auction-time${timeParts.urgent ? " is-urgent" : ""}`}
          data-testid="catalogue-card-time-left"
        >
          · ⏱ {timeParts.text}
        </span>
      ) : null}
    </div>
  );
}
