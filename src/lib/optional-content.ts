export const OPTIONAL_CONTENT_STORAGE_KEY = "licitatiero-optional-content";
export type OptionalContentChoice = "accepted" | "rejected";
export function parseOptionalContent(
  raw: string | null,
): OptionalContentChoice | null {
  if (raw === "accepted" || raw === "rejected") return raw;
  return null;
}
/** Default when unset: rejected (no optional embeds). */
export function allowsOptionalContent(
  preference: OptionalContentChoice | null,
): boolean {
  return preference === "accepted";
}
export function readOptionalContentFromStorage(
  getItem: (key: string) => string | null,
): OptionalContentChoice | null {
  return parseOptionalContent(getItem(OPTIONAL_CONTENT_STORAGE_KEY));
}