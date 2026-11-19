import { demoListings } from "@/lib/fixtures";
import type { CatalogueMapFilterParams } from "@/lib/catalogue-map-path";

/** Demo / fallback allowlist; refreshed from `/api/catalogue` on `/map`. */
export function defaultCatalogueNeighborhoodAllowlist(): Set<string> {
  return new Set(demoListings.map((item) => item.neighborhood));
}

const MAX_FILTER_PRICE_MAJOR = 10_000_000;
const VALID_PROPERTY_TYPES = new Set(["apartment", "house"]);
const VALID_TRANSACTION_TYPES = new Set(["sale", "rent"]);
const VALID_ROOM_MINIMUMS = new Set([2, 3, 4, 5]);

export type SanitizedCatalogueMapFilters = CatalogueMapFilterParams;

function sanitizeQuery(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length > 120) return undefined;
  return trimmed;
}

function sanitizeNeighborhood(
  value: string | undefined,
  allowlist: Set<string>,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !allowlist.has(trimmed)) return undefined;
  return trimmed;
}

function sanitizeMaxPrice(value?: string): string | undefined {
  const major = Number(value);
  if (!Number.isFinite(major) || major <= 0) return undefined;
  const clamped = Math.min(Math.floor(major), MAX_FILTER_PRICE_MAJOR);
  return String(clamped);
}

function sanitizeTransaction(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !VALID_TRANSACTION_TYPES.has(trimmed)) return undefined;
  return trimmed;
}

function sanitizeRooms(value?: string): string | undefined {
  const rooms = Number(value);
  if (!Number.isFinite(rooms) || !VALID_ROOM_MINIMUMS.has(rooms)) {
    return undefined;
  }
  return String(rooms);
}

function sanitizePropertyType(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !VALID_PROPERTY_TYPES.has(trimmed)) return undefined;
  return trimmed;
}

export function sanitizeCatalogueMapFilters(
  raw: CatalogueMapFilterParams,
  neighborhoodAllowlist: Set<string>,
): SanitizedCatalogueMapFilters {
  const out: SanitizedCatalogueMapFilters = {};
  const transaction = sanitizeTransaction(raw.transaction);
  if (transaction) out.transaction = transaction;
  const q = sanitizeQuery(raw.q);
  if (q) out.q = q;
  const neighborhood = sanitizeNeighborhood(raw.neighborhood, neighborhoodAllowlist);
  if (neighborhood) out.neighborhood = neighborhood;
  const maxPrice = sanitizeMaxPrice(raw.maxPrice);
  if (maxPrice) out.maxPrice = maxPrice;
  const rooms = sanitizeRooms(raw.rooms);
  if (rooms) out.rooms = rooms;
  const propertyType = sanitizePropertyType(raw.propertyType);
  if (propertyType) out.propertyType = propertyType;
  return out;
}
