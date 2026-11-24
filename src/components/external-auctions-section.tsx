"use client";

import { useMemo, useState } from "react";
import type { ExternalAuctionListing } from "@/lib/types-external-auction";
import type { ExternalAuctionCategory } from "@/lib/repes/category";
import { externalAuctionRankingLine } from "@/lib/external-auction-copy";
import { ExternalAuctionCard } from "@/components/external-auction-card";
import { externalAuctionDsaReportHref } from "@/lib/external-auction-report-href";
import { usePlatform } from "@/components/platform";

type CategoryFilter = "all" | ExternalAuctionCategory;
type TimingFilter = "upcoming" | "all";

const FILTER_OPTIONS: CategoryFilter[] = [
  "all",
  "real_estate",
  "vehicle",
  "equipment",
  "other",
];

function isUpcoming(listing: ExternalAuctionListing): boolean {
  if (listing.ended_at_source) return false;
  return new Date(listing.auction_at).getTime() >= Date.now();
}

export function ExternalAuctionsSection({
  listings,
  reportAnchorListingId,
}: {
  listings: ExternalAuctionListing[];
  reportAnchorListingId?: string;
}) {
  const { t, language } = usePlatform();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [timing, setTiming] = useState<TimingFilter>("upcoming");

  const filtered = useMemo(() => {
    const byTiming =
      timing === "upcoming" ? listings.filter(isUpcoming) : listings;
  return category === "all"
      ? byTiming
      : byTiming.filter((row) => row.category === category);
  }, [category, listings, timing]);

  const filterLabel = (value: CategoryFilter): string => {
    if (value === "all") return t("Toate", "All");
    if (value === "real_estate") return t("Imobile", "Real estate");
    if (value === "vehicle") return t("Vehicule", "Vehicles");
    if (value === "equipment") return t("Utilaje", "Equipment");
    return t("Altele", "Other");
  };

  if (!listings.length) return null;

  return (
    <section
      className="external-auction-section"
      aria-labelledby="external-auction-heading"
      data-testid="external-auction-section"
    >
      <div className="eyebrow">
        {t("LICITAȚII REALE (EXTERN)", "REAL EXTERNAL AUCTIONS")}
      </div>
      <h2 id="external-auction-heading">
        {t("Licitații reale, externe", "Real external auctions")}
      </h2>
      <p className="external-auction-ranking">
        {externalAuctionRankingLine(language)}
      </p>
      <div
        className="external-auction-filters"
        role="group"
        aria-label={t("Filtrează pe categorie", "Filter by category")}
        data-testid="external-auction-category-filters"
      >
        {FILTER_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            className={`filter-chip${category === value ? " active" : ""}`}
            aria-pressed={category === value}
            data-category={value}
            onClick={() => setCategory(value)}
          >
            {filterLabel(value)}
          </button>
        ))}
      </div>
      <div
        className="external-auction-filters"
        role="group"
        aria-label={t("Filtrează după dată", "Filter by date")}
        data-testid="external-auction-timing-filters"
      >
        <button
          type="button"
          className={`filter-chip${timing === "upcoming" ? " active" : ""}`}
          aria-pressed={timing === "upcoming"}
          onClick={() => setTiming("upcoming")}
        >
          {t("Viitoare", "Upcoming")}
        </button>
        <button
          type="button"
          className={`filter-chip${timing === "all" ? " active" : ""}`}
          aria-pressed={timing === "all"}
          onClick={() => setTiming("all")}
        >
          {t("Include încheiate", "Include ended")}
        </button>
      </div>
      {filtered.length ? (
        <div className="property-grid external-auction-grid">
          {filtered.map((row) => (
            <ExternalAuctionCard
              key={row.source_id}
              listing={row}
              reportHref={
                reportAnchorListingId
                  ? externalAuctionDsaReportHref(
                      reportAnchorListingId,
                      row.source_id,
                    )
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p className="external-auction-empty">
          {t(
            "Nicio licitație externă în această categorie.",
            "No external auctions in this category.",
          )}
        </p>
      )}
    </section>
  );
}
