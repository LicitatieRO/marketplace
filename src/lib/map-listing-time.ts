import { dateTime, money } from "@/lib/format";
import { formatEurCompact } from "@/lib/format-eur-compact";
import type { MapListingStatus } from "@/lib/map-listing-types";
import type { Language } from "@/lib/types";

export function effectiveServerNowMs(
  clientNowMs: number,
  serverClockOffsetMs: number,
): number {
  return clientNowMs + serverClockOffsetMs;
}

function remainingSeconds(
  endsAt: string | null,
  nowMs: number,
): number | null {
  if (!endsAt || nowMs <= 0) return null;
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - nowMs) / 1000));
}

export function formatMapTimeLeftParts(
  endsAt: string | null,
  nowMs: number,
  language: Language,
): { text: string; urgent: boolean } | null {
  const total = remainingSeconds(endsAt, nowMs);
  if (total === null) return null;
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const urgent = total < 3_600;
  if (language === "ro") {
    const base = `${days}z ${hours}h`;
    return {
      text:
        urgent && total > 0
          ? `${minutes}m ${seconds}s`
          : total === 0
            ? "0z 0h"
            : base,
      urgent,
    };
  }
  const base = `${days}d ${hours}h`;
  return {
    text:
      urgent && total > 0
        ? `${minutes}m ${seconds}s`
        : total === 0
          ? "0d 0h"
          : base,
    urgent,
  };
}

export function formatMapTimeLeftLabel(
  status: MapListingStatus,
  startsAt: string | null,
  endsAt: string | null,
  nowMs: number,
  language: Language,
): { text: string; urgent: boolean } | null {
  if (status === "scheduled" && startsAt && nowMs > 0) {
    return {
      text:
        language === "ro"
          ? `Începe ${dateTime(startsAt, "ro")}`
          : `Starts ${dateTime(startsAt, "en")}`,
      urgent: false,
    };
  }
  if (status === "ended") {
    return {
      text:
        language === "ro" ? "Licitație încheiată" : "Auction ended",
      urgent: false,
    };
  }
  if (status !== "live") return null;
  const parts = formatMapTimeLeftParts(endsAt, nowMs, language);
  if (!parts) return null;
  const prefix =
    language === "ro" ? "Se încheie în " : "Ends in ";
  return { text: `${prefix}${parts.text}`, urgent: parts.urgent };
}

export function formatMapEndedCardLine(
  currentBidCents: number,
  language: Language,
): string {
  const price = money(currentBidCents, language);
  return language === "ro"
    ? `Licitație încheiată · Preț final ${price} (simulare)`
    : `Auction ended · Final price ${price} (simulated)`;
}

export function formatMapPillAriaLabel(
  neighbourhood: string,
  currentBidCents: number,
  status: MapListingStatus,
  startsAt: string | null,
  endsAt: string | null,
  nowMs: number,
  language: Language,
): string {
  const price =
    language === "ro"
      ? `ofertă curentă ${formatEurCompact(currentBidCents, "ro")}`
      : `current bid ${formatEurCompact(currentBidCents, "en")}`;
  const timePhrase = (() => {
    if (status === "ended") {
      return language === "ro" ? "licitație încheiată" : "auction ended";
    }
    if (status === "scheduled" && startsAt && nowMs > 0) {
      return language === "ro"
        ? `programat, începe ${dateTime(startsAt, "ro")}`
        : `scheduled, starts ${dateTime(startsAt, "en")}`;
    }
    if (status === "live") {
      const parts = formatMapTimeLeftParts(endsAt, nowMs, language);
      if (!parts) return "";
      return language === "ro"
        ? `se încheie în ${parts.text}`
        : `ends in ${parts.text}`;
    }
    return "";
  })();
  return [neighbourhood, price, timePhrase].filter(Boolean).join(", ");
}

export function formatMapClusterAriaLabel(
  count: number,
  language: Language,
): string {
  return language === "ro"
    ? `Grup de ${count} proprietăți, apasă pentru zoom`
    : `Cluster of ${count} properties, press to zoom`;
}
