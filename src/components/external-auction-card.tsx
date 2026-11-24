"use client";

import { Calendar, ExternalLink, MapPin, Scale, ShieldAlert } from "lucide-react";
import type { ExternalAuctionListing } from "@/lib/types-external-auction";
import type { Language } from "@/lib/types";
import {
  externalAuctionDisclaimer,
  externalAuctionEndedAtSourceLabel,
  externalAuctionOfficialNoticeCta,
  externalAuctionPocNote,
  externalAuctionSourceBadge,
  externalAuctionTakedown,
  externalAuctionVerifyAtSource,
  externalAuctionWithdrawnLabel,
} from "@/lib/external-auction-copy";
import { isAllowedRepesSourceUrl } from "@/lib/repes/source-url";
import { usePlatform } from "@/components/platform";

const BUCHAREST_TZ = "Europe/Bucharest";
const FORBIDDEN_CONTROL_LABELS = [
  "place_bid",
  "confirm",
  "highest bidder",
  "promote",
] as const;

export function externalAuctionCardForbiddenControls(): readonly string[] {
  return FORBIDDEN_CONTROL_LABELS;
}

type Props = {
  listing: ExternalAuctionListing;
  reportHref?: string;
};

function assetTitle(
  listing: ExternalAuctionListing,
  t: (ro: string, en: string) => string,
): string {
  if (listing.category === "vehicle") return t("Vehicul", "Vehicle");
  if (listing.category === "equipment") return t("Utilaj / echipament", "Equipment");
  if (listing.category === "other") return t("Bun mobil", "Movable asset");
  if (listing.property_type === "other")
    return t("Imobil", "Property");
  if (listing.property_type === "house") return t("Casă", "House");
  if (listing.property_type === "land") return t("Teren", "Land");
  if (listing.property_type === "commercial") return t("Comercial", "Commercial");
  if (listing.property_type === "apartment") return t("Apartament", "Apartment");
  return t("Imobil", "Property");
}

export function ExternalAuctionCardView({
  listing,
  reportHref,
  language,
  t,
}: Props & {
  language: Language;
  t: (ro: string, en: string) => string;
}) {
  const locale: Language = language;
  const sourceName = t("REPES / executori.ro", "REPES / executori.ro");
  const localeId = language === "ro" ? "ro-RO" : "en-GB";
  const auctionDate = new Date(listing.auction_at).toLocaleString(localeId, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUCHAREST_TZ,
  });
  const retrievalDate = new Date(listing.retrieved_at).toLocaleString(localeId, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BUCHAREST_TZ,
  });
  const formatMoney = (minor: number, currency: string) =>
    new Intl.NumberFormat(language === "ro" ? "ro-RO" : "en-IE", {
      style: "currency",
      currency,
      maximumFractionDigits: minor % 100 ? 2 : 0,
    }).format(minor / 100);
  const priceLabel = formatMoney(listing.price_minor, listing.currency);
  const safeSourceUrl = isAllowedRepesSourceUrl(listing.source_url)
    ? listing.source_url
    : null;
  const ended = listing.ended_at_source === true;

  return (
    <article
      className="property-card external-auction-card"
      data-testid="external-auction-card"
      data-external-auction="repes"
    >
      <div className="card-body">
        <div className="external-auction-badges">
          <span className="badge badge-navy" data-testid="external-auction-badge">
            {externalAuctionSourceBadge(locale, sourceName)}
          </span>
          {listing.withdrawn ? (
            <span className="badge" data-testid="external-auction-withdrawn">
              {externalAuctionWithdrawnLabel(locale)}
            </span>
          ) : null}
          {ended ? (
            <span className="badge" data-testid="external-auction-ended">
              {externalAuctionEndedAtSourceLabel(locale)}
            </span>
          ) : null}
        </div>
        <div className="location">
          <MapPin size={13} />
          {listing.locality_label} <span>· {listing.judet}</span>
        </div>
        <h3 className="external-auction-title">
          {assetTitle(listing, t)}
          {listing.area_sqm ? (
            <span className="external-auction-area"> · {listing.area_sqm} m²</span>
          ) : null}
        </h3>
        <p className="external-auction-disclaimer">
          {externalAuctionDisclaimer(locale, listing.issuing_authority)}
        </p>
        <div className="property-specs">
          <span>
            <Calendar size={14} />
            {auctionDate}
          </span>
          {listing.guarantee_minor ? (
            <span>
              <Scale size={14} />
              {t("Garanție", "Guarantee")}:{" "}
              {formatMoney(listing.guarantee_minor, listing.currency)}
            </span>
          ) : null}
        </div>
        <div className="property-price external-auction-price">{priceLabel}</div>
        <p className="external-auction-verify">
          {externalAuctionVerifyAtSource(locale, listing.retrieved_at)}
        </p>
        <p className="external-auction-meta">
          {t("Ultima verificare", "Last checked")}: {retrievalDate}
        </p>
        {safeSourceUrl ? (
          <a
            className="button-link external-auction-source-link"
            href={safeSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="external-auction-source-link"
          >
            {externalAuctionOfficialNoticeCta(locale)} <ExternalLink size={14} />
          </a>
        ) : null}
        {reportHref ? (
          <p className="external-auction-takedown">
            <ShieldAlert size={14} aria-hidden />
            {externalAuctionTakedown(locale)}{" "}
            <a href={reportHref}>{t("Formular de raportare", "Report form")}</a>
          </p>
        ) : (
          <p className="external-auction-takedown">
            <ShieldAlert size={14} aria-hidden />
            {externalAuctionTakedown(locale)}
          </p>
        )}
        <p className="external-auction-poc-note">{externalAuctionPocNote(locale)}</p>
      </div>
    </article>
  );
}

export function ExternalAuctionCard(props: Props) {
  const { t, language } = usePlatform();
  return (
    <ExternalAuctionCardView {...props} language={language} t={t} />
  );
}
