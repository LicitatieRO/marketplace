import type { RepesAuctionEntry } from "@/lib/repes/types";

/** Allowlisted fields persisted and shown after ingest redaction. */
export type RedactedExternalAuction = {
  source: "repes";
  source_id: string;
  repes_case_id: string;
  repes_auction_id: string;
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

const CNP_PATTERN = /\b[12]\d{12}\b/g;
const CF_PATTERN =
  /\b(c\.?\s*f\.?|carte\s+funciar[ăa]|nr\.?\s*cf|cadastral)\s*[:\s#-]*\d*/giu;
const DEBTOR_CREDITOR_PATTERN =
  /\b(?:debitor|creditor|debitorul|creditorul)\b[^.;,\n]{0,120}/giu;
const PERSONAL_NAME_AFTER_ROLE =
  /\b(?:debitor|creditor)\s+(?:[A-ZĂÂÎȘȚ][\p{L}'-]+(?:\s+[A-ZĂÂÎȘȚ][\p{L}'-]+)+)/giu;
const CASE_FILE_PATTERN =
  /\b\d{1,6}\s*\/\s*ex\s*\/\s*\d{4}\b|\b(?:dosar|file)\s*(?:nr\.?)?\s*[:#]?\s*[\w/-]+/giu;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_PATTERN = /(?:\+40|0)\s*[\d\s.-]{8,14}/g;

const CATEGORY_TO_PROPERTY: Record<string, string> = {
  APT: "apartment",
  HOU: "house",
  COM: "commercial",
  LND: "land",
};

function stripSensitiveFragments(text: string): string {
  return text
    .replace(DEBTOR_CREDITOR_PATTERN, "")
    .replace(PERSONAL_NAME_AFTER_ROLE, "")
    .replace(CNP_PATTERN, "")
    .replace(CF_PATTERN, "")
    .replace(CASE_FILE_PATTERN, "")
    .replace(EMAIL_PATTERN, "")
    .replace(PHONE_PATTERN, "");
}

function minorUnits(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

function parseAreaSqm(entry: RepesAuctionEntry): number | null {
  const props = entry.asset?.properties ?? [];
  for (const row of props) {
    const name = (row.name ?? "").toLocaleLowerCase("ro");
    if (name.includes("supraf") || name.includes("arie")) {
      const digits = (row.value ?? "").replace(/[^\d.,]/g, "").replace(",", ".");
      const parsed = Number(digits);
      if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
    }
  }
  const haystack = stripSensitiveFragments(
    `${entry.asset?.name ?? ""} ${entry.asset?.description ?? ""}`,
  );
  const match = haystack.match(/(\d{1,5}(?:[.,]\d{1,2})?)\s*m(?:²|2|p)?\b/i);
  if (match) {
    const parsed = Number(match[1].replace(",", "."));
    if (Number.isFinite(parsed)) return Math.round(parsed);
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
  return `https://prod.executori.ro/repes/#/auction/${encCase}/${encId}`;
}

function issuingAuthority(entry: RepesAuctionEntry): string {
  const org = entry.auctioneer?.organisation;
  const raw = org?.description?.trim() || org?.name?.trim() || "";
  const cleaned = stripSensitiveFragments(raw).replace(/\s+/g, " ").trim();
  if (cleaned) return cleaned.slice(0, 160);
  return "Executor judecătoresc (REPES)";
}

/**
 * Pure allowlist redaction: drops debtor/creditor identity, addresses, case ids, CF/cadastral refs.
 */
export function redactRepesAuctionEntry(
  entry: RepesAuctionEntry,
): RedactedExternalAuction | null {
  if (!entry.id || !entry.caseId) return null;
  if (entry.asset?.type && entry.asset.type !== "IMO") return null;

  const category = entry.asset?.category ?? "";
  const propertyType = CATEGORY_TO_PROPERTY[category];
  if (!propertyType) return null;

  const county =
    entry.asset?.address?.county ??
    entry.asset?.address?.region ??
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

  return {
    source: "repes",
    source_id: `repes:${entry.caseId}:${entry.id}`,
    repes_case_id: entry.caseId,
    repes_auction_id: entry.id,
    property_type: propertyType,
    locality_label: localityFromEntry(entry),
    judet,
    area_sqm: parseAreaSqm(entry),
    price_minor: priceMinor,
    currency,
    guarantee_minor: guaranteeMinor,
    auction_at: auctionAt,
    issuing_authority: issuingAuthority(entry),
    source_url: repesSourceUrl(entry.caseId, entry.id),
    withdrawn,
  };
}

/** Scrub free-text snippets (used in tests to prove embedded PII removal). */
export function scrubRepesFreeText(text: string): string {
  return stripSensitiveFragments(text).replace(/\s+/g, " ").trim();
}
