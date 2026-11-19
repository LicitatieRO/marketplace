"use client";

import { useState } from "react";
import { usePlatform } from "@/components/platform";
import {
  isAuthProviderEnabled,
  oauthCallbackRedirect,
  oauthProviderLabel,
  OAUTH_PROVIDERS,
  startOAuthSignIn,
  type OAuthProviderId,
} from "@/lib/auth-oauth";
import { getBrowserSupabase } from "@/lib/browser-supabase";

export function SocialLoginButtons({ nextPath }: { nextPath: string }) {
  const { t, configured } = usePlatform();
  const [busyProvider, setBusyProvider] = useState<OAuthProviderId | null>(null);
  const [error, setError] = useState("");

  async function onProviderClick(provider: OAuthProviderId) {
    if (!configured || !isAuthProviderEnabled(provider)) return;
    setBusyProvider(provider);
    setError("");
    try {
      const redirectTo = oauthCallbackRedirect(window.location.origin, nextPath);
      const client = getBrowserSupabase();
      const { started, error: oauthError } = await startOAuthSignIn(
        client,
        provider,
        redirectTo,
      );
      if (!started) {
        setError(
          oauthError === "provider_disabled"
            ? t("Furnizorul nu este activ.", "This provider is not active.")
            : t(
                "Nu am putut porni autentificarea.",
                "Could not start sign-in.",
              ),
        );
      }
    } catch {
      setError(
        t(
          "Conexiune indisponibilă. Reîncearcă.",
          "Connection unavailable. Please try again.",
        ),
      );
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <div className="social-login" data-testid="social-login">
      <p className="social-login-divider muted small">
        {t("sau continuă cu", "or continue with")}
      </p>
      <div className="social-login-grid">
        {OAUTH_PROVIDERS.map((provider) => {
          const enabled = configured && isAuthProviderEnabled(provider);
          const label = oauthProviderLabel(provider);
          const comingSoon = t("În curând", "Coming soon");
          return (
            <button
              key={provider}
              type="button"
              className="button secondary social-login-btn"
              data-testid={`social-login-${provider}`}
              disabled={!enabled || Boolean(busyProvider)}
              aria-disabled={!enabled}
              onClick={() => {
                if (enabled) void onProviderClick(provider);
              }}
            >
              {t(label.ro, label.en)}
              {!enabled ? (
                <span className="social-login-soon muted small">
                  {comingSoon}
                </span>
              ) : busyProvider === provider ? (
                <span className="muted small">…</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="feedback error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
