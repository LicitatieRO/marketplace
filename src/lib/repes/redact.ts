import type { RepesAuctionEntry } from "@/lib/repes/types";
import {
  normalizeRepesEntryCategory,
  repesPropertyTypeForCategory,
  type ExternalAuctionCategory,
} from "@/lib/repes/category";
import { assertAllowedRepesSourceUrl } from "@/lib/repes/source-url";
import { stripSensitiveFragments } from "@/lib/repes/scrub-text";

/** Allowlisted fields persisted and shown after ingest redaction. */
export type RedactedExternalAuction = {
  source: "repes";
  source_id: string;
  repes_case_id: string;
  repes_auction_id: string;
  category: ExternalAuctionCategory;
  property_type: string;
  locality_label: string;
  judet: string;
  area_sqm: number | null;
  price_minor: number;
  currency: string;
  guarantee_minor: number | null;
  auction_at: string;
  issuing_authority: string;
  source_url: string;
  withdrawn: boolean;
};

function minorUnits(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

function parseAreaSqmFromProperties(entry: RepesAuctionEntry): number | null {
  const props = entry.asset?.properties ?? [];
  for (const row of props) {
    const name = (row.name ?? "").toLocaleLowerCase("ro");
    if (name.includes("supraf") || name.includes("arie")) {
      const digits = (row.value ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
      const parsed = Number(digits);
      if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
    }
  }
  return null;
}

function localityFromEntry(entry: RepesAuctionEntry): string {
  const city = entry.asset?.address?.city?.trim() ?? "";
  const region = entry.asset?.address?.region?.trim() ?? "";
  const county = entry.asset?.address?.county?.trim() ?? "";
  const sectorMatch = `${city} ${region} ${county}`.match(/sector(?:ul)?\s*(\d)/i);
  if (sectorMatch) {
    return `Sector ${sectorMatch[1]}`;
  }
  if (city) return city;
  if (county) return county;
  return "București";
}

function repesSourceUrl(caseId: string, auctionId: string): string {
  const encCase = encodeURIComponent(caseId);
  const encId = encodeURIComponent(auctionId);
  const raw = `https://prod.executori.ro/repes/#/auction/${encCase}/${encId}`;
  return assertAllowedRepesSourceUrl(raw);
}

function issuingAuthority(entry: RepesAuctionEntry): string {
  const org = entry.auctioneer?.organisation;
  const raw = org?.name?.trim() ?? "";
  const cleaned = stripSensitiveFragments(raw).replace(/\s+/g, " ").trim();
  if (cleaned) return cleaned.slice(0, 160);
  return "Executor judecătoresc (REPES)";
}

export function buildRepesSourceId(caseIdHash: string, auctionId: string): string {
  return `repes:${caseIdHash}:${auctionId}`;
}

export function redactRepesAuctionEntry(
  entry: RepesAuctionEntry,
  caseIdHash: string,
): RedactedExternalAuction | null {
  if (!entry.id || !entry.caseId || !caseIdHash) return null;

  const listingCategory = normalizeRepesEntryCategory(entry);
  if (!listingCategory) return null;

  const county =
    entry.asset?.address?.county ??
    entry.asset?.address?.region ??
    entry.address?.county ??
    "București";
  const judet = county.trim() || "București";

  const price = entry.asset?.price;
  const currency = (price?.currency ?? "RON").toUpperCase();
  const priceMinor = minorUnits(price?.value);
  if (priceMinor <= 0) return null;

  const guaranteeMinor = entry.asset?.guarantee
    ? minorUnits(entry.asset.guarantee.value)
    : null;

  const auctionAt = entry.date?.trim();
  if (!auctionAt) return null;

  const withdrawn = (entry.status ?? "").toUpperCase() !== "ACT";

  const propertyType = repesPropertyTypeForCategory(
    listingCategory,
    entry.asset?.category,
  );

  let sourceUrl: string;
  try {
    sourceUrl = repesSourceUrl(entry.caseId, entry.id);
  } catch {
    return null;
  }

  return {
    source: "repes",
    source_id: buildRepesSourceId(caseIdHash, entry.id),
    repes_case_id: caseIdHash,
    repes_auction_id: entry.id,
    category: listingCategory,
    property_type: propertyType,
    locality_label: localityFromEntry(entry),
    judet,
    area_sqm:
      listingCategory === "real_estate" ? parseAreaSqmFromProperties(entry) : null,
    price_minor: priceMinor,
    currency,
    guarantee_minor: guaranteeMinor,
    auction_at: auctionAt,
    issuing_authority: issuingAuthority(entry),
    source_url: sourceUrl,
    withdrawn,
  };
}

export { scrubRepesFreeText } from "@/lib/repes/scrub-text";
