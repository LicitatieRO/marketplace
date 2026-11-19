export const OPEN_COOKIE_PREFERENCES_EVENT = "licitatiero-open-cookie-preferences";
export const OPTIONAL_CONTENT_CHANGED_EVENT =
  "licitatiero-optional-content-changed";

export function openCookiePreferences(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COOKIE_PREFERENCES_EVENT));
}

export function notifyOptionalContentChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPTIONAL_CONTENT_CHANGED_EVENT));
}