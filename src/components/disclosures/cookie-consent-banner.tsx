"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePlatform } from "@/components/platform";
import {
  OPTIONAL_CONTENT_STORAGE_KEY,
  readOptionalContentFromStorage,
  type OptionalContentChoice,
} from "@/lib/optional-content";
import {
  notifyOptionalContentChanged,
  OPEN_COOKIE_PREFERENCES_EVENT,
  OPTIONAL_CONTENT_CHANGED_EVENT,
  openCookiePreferences,
} from "@/lib/optional-content-events";
import { cookieBanner } from "./legal-copy";

function subscribePreference(onStoreChange: () => void) {
  const handler = () => onStoreChange();
  window.addEventListener("storage", handler);
  window.addEventListener(OPTIONAL_CONTENT_CHANGED_EVENT, handler);
  window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(OPTIONAL_CONTENT_CHANGED_EVENT, handler);
    window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, handler);
  };
}

function readPreferenceSnapshot(): OptionalContentChoice | null {
  return readOptionalContentFromStorage((key) => localStorage.getItem(key));
}

export function useOptionalContentPreference(): OptionalContentChoice | null {
  return useSyncExternalStore(
    subscribePreference,
    readPreferenceSnapshot,
    () => null,
  );
}

/** Returns whether optional third-party embeds (map, tours) may load. */
export function useAllowsOptionalContent(): boolean {
  const preference = useOptionalContentPreference();
  return preference === "accepted";
}

export function CookiePreferencesControl({
  className,
}: {
  className?: string;
}) {
  const { t } = usePlatform();
  return (
    <button
      type="button"
      className={className ?? "button link-button"}
      data-testid="cookie-preferences-control"
      onClick={() => openCookiePreferences()}
    >
      {t(cookieBanner.preferencesRo, cookieBanner.preferencesEn)}
    </button>
  );
}

export function CookieConsentBanner() {
  const { t } = usePlatform();
  const storedPreference = useOptionalContentPreference();
  const [reopen, setReopen] = useState(false);

  useEffect(() => {
    const onOpen = () => setReopen(true);
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, onOpen);
  }, []);

  const dismissed = storedPreference !== null && !reopen;
  function persist(choice: OptionalContentChoice) {
    localStorage.setItem(OPTIONAL_CONTENT_STORAGE_KEY, choice);
    setReopen(false);
    notifyOptionalContentChanged();
  }

  if (dismissed) return null;
  return (
    <div
      className="feedback notice cookie-consent-sheet"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      data-testid="cookie-consent-banner"
    >
      <p id="cookie-consent-title" style={{ fontWeight: 600, marginBottom: 8 }}>
        {t(cookieBanner.titleRo, cookieBanner.titleEn)}
      </p>
      <p className="muted small" style={{ marginBottom: 12 }}>
        {t(cookieBanner.bodyRo, cookieBanner.bodyEn)}
      </p>
      <CookieConsentActions
        t={t}
        onNecessary={() => persist("rejected")}
        onAccept={() => persist("accepted")}
      />
      <p className="muted small" style={{ marginTop: 10 }}>
        <Link href="/legal/cookies">{t("Politica de cookie-uri", "Cookie policy")}</Link>
        {" · "}
        <Link href="/legal/privacy">
          {t("Confidențialitate", "Privacy")}
        </Link>
      </p>
    </div>
  );
}

const cookieConsentChoiceClass = "button primary cookie-consent-choice";

function CookieConsentActions({
  t,
  onNecessary,
  onAccept,
}: {
  t: (ro: string, en: string) => string;
  onNecessary: () => void;
  onAccept: () => void;
}) {
  return (
    <div className="cookie-consent-actions">
      <button
        type="button"
        className={cookieConsentChoiceClass}
        data-testid="cookie-consent-reject"
        onClick={onNecessary}
      >
        {t(cookieBanner.necessaryRo, cookieBanner.necessaryEn)}
      </button>
      <button
        type="button"
        className={cookieConsentChoiceClass}
        data-testid="cookie-consent-accept"
        onClick={onAccept}
      >
        {t(cookieBanner.acceptRo, cookieBanner.acceptEn)}
      </button>
    </div>
  );
}
