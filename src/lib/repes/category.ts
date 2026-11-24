import type { RepesAuctionEntry } from "@/lib/repes/types";

export type ExternalAuctionCategory =
  | "real_estate"
  | "vehicle"
  | "equipment"
  | "other";

const REAL_ESTATE_IMO_CATEGORIES = new Set(["APT", "HOU", "COM", "LND", "STU"]);

const VEHICLE_TYPES = new Set(["AUT", "VEH", "AUTO", "VEHICLE"]);
const VEHICLE_CATEGORIES = new Set([
  "AUT",
  "CAR",
  "MOT",
  "MOTO",
  "TRK",
  "TRUCK",
  "VAN",
  "REM",
  "TRR",
]);

const EQUIPMENT_TYPES = new Set(["MAS", "MAC", "EQP", "EQUIP", "EQUIPMENT"]);
const EQUIPMENT_CATEGORIES = new Set([
  "MAS",
  "MAC",
  "EQP",
  "IND",
  "AGR",
  "CON",
  "ELC",
  "IT",
]);

const IMO_TO_PROPERTY: Record<string, string> = {
  APT: "apartment",
  HOU: "house",
  COM: "commercial",
  LND: "land",
  STU: "studio",
};

export function normalizeRepesCategory(
  assetType: string | null | undefined,
  assetCategory: string | null | undefined,
): ExternalAuctionCategory | null {
  const type = (assetType ?? "").trim().toUpperCase();
  const category = (assetCategory ?? "").trim().toUpperCase();
  if (!type && !category) return null;

  if (type === "IMO" || REAL_ESTATE_IMO_CATEGORIES.has(category)) {
    return "real_estate";
  }
  if (VEHICLE_TYPES.has(type) || VEHICLE_CATEGORIES.has(category)) {
    return "vehicle";
  }
  if (EQUIPMENT_TYPES.has(type) || EQUIPMENT_CATEGORIES.has(category)) {
    return "equipment";
  }
  return "other";
}

export function repesPropertyTypeForCategory(
  listingCategory: ExternalAuctionCategory,
  assetCategory: string | null | undefined,
): string {
  if (listingCategory === "real_estate") {
    const key = (assetCategory ?? "").trim().toUpperCase();
    return IMO_TO_PROPERTY[key] ?? "apartment";
  }
  if (listingCategory === "vehicle") return "vehicle";
  if (listingCategory === "equipment") return "equipment";
  return "other";
}

export function normalizeRepesEntryCategory(
  entry: RepesAuctionEntry,
): ExternalAuctionCategory | null {
  return normalizeRepesCategory(entry.asset?.type, entry.asset?.category);
}
