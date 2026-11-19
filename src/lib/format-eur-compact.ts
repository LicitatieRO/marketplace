import type { Language } from "./types";

export function formatEurCompact(cents: number, language: Language = "ro"): string {
  if (!Number.isFinite(cents)) return "—";
  const major = cents / 100;
  if (major < 10_000) {
    return new Intl.NumberFormat(language === "ro" ? "ro-RO" : "en-IE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(major);
  }
  return new Intl.NumberFormat(language === "ro" ? "ro-RO" : "en-IE", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(major);
}