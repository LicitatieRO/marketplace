import type { RepesAuctionEntry } from "@/lib/repes/types";

const BUCHAREST_ILFOV_KEYS = new Set(["bucuresti", "ilfov"]);

/** Normalize judet/county names for Bucharest + Ilfov matching (ASCII fold). */
export function normalizeJudetKey(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  return trimmed
    .toLocaleLowerCase("ro")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function isBucharestIlfovCounty(county: string | null | undefined): boolean {
  const key = normalizeJudetKey(county);
  return BUCHAREST_ILFOV_KEYS.has(key);
}

export function repesEntryCounty(entry: RepesAuctionEntry): string | null {
  return (
    entry.asset?.address?.county ??
    entry.asset?.address?.region ??
    entry.address?.county ??
    null
  );
}

export function isBucharestIlfovRepesEntry(entry: RepesAuctionEntry): boolean {
  if (entry.asset?.type && entry.asset.type !== "IMO") return false;
  const category = entry.asset?.category ?? "";
  if (!["APT", "HOU", "COM", "LND"].includes(category)) return false;
  return isBucharestIlfovCounty(repesEntryCounty(entry));
}

export function filterBucharestIlfovRepesEntries(
  entries: RepesAuctionEntry[],
): RepesAuctionEntry[] {
  return entries.filter(isBucharestIlfovRepesEntry);
}
