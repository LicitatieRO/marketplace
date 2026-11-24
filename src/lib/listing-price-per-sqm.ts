import type { Language, TransactionType } from "@/lib/types";
import { money } from "@/lib/format";

/** Price in minor units per square metre, or null when area is not usable. */
export function pricePerSqmMinor(
  priceMinor: number,
  areaSqm: number,
): number | null {
  if (!Number.isFinite(priceMinor) || priceMinor <= 0) return null;
  if (!Number.isFinite(areaSqm) || areaSqm <= 0) return null;
  return Math.round(priceMinor / areaSqm);
}

export function formatPricePerSqm(
  priceMinor: number,
  areaSqm: number,
  language: Language,
  transactionType: TransactionType,
): string | null {
  const perSqmMinor = pricePerSqmMinor(priceMinor, areaSqm);
  if (perSqmMinor === null) return null;
  const amount = money(perSqmMinor, language);
  if (transactionType === "rent") {
    return language === "ro"
      ? `${amount} / m² / lună`
      : `${amount} / m² / month`;
  }
  return `${amount} / m²`;
}