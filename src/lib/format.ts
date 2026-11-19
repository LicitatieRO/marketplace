import type { Language } from "./types";
export function money(minor: number, language: Language = "ro") {
  return new Intl.NumberFormat(language === "ro" ? "ro-RO" : "en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: minor % 100 ? 2 : 0,
  }).format(minor / 100);
}
export function dateTime(value: string, language: Language = "ro") {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(language === "ro" ? "ro-RO" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
