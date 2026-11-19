import type { Provider } from "@supabase/supabase-js";

export type OAuthProviderId = "google" | "apple" | "facebook";

const ENABLED_ENV: Record<OAuthProviderId, string> = {
  google: "NEXT_PUBLIC_AUTH_GOOGLE_ENABLED",
  apple: "NEXT_PUBLIC_AUTH_APPLE_ENABLED",
  facebook: "NEXT_PUBLIC_AUTH_FACEBOOK_ENABLED",
};

export const OAUTH_PROVIDERS: OAuthProviderId[] = ["google", "apple", "facebook"];

/** Minimal scopes per issue #163; no ads, contacts, or extended Graph permissions. */
export const OAUTH_PROVIDER_SCOPES: Record<OAuthProviderId, string> = {
  google: "openid email profile",
  apple: "name email",
  facebook: "email public_profile",
};

const PROVIDER_LABEL: Record<OAuthProviderId, { ro: string; en: string }> = {
  google: { ro: "Google", en: "Google" },
  apple: { ro: "Apple", en: "Apple" },
  facebook: { ro: "Facebook", en: "Facebook" },
};

export function oauthProviderLabel(
  provider: OAuthProviderId,
): { ro: string; en: string } {
  return PROVIDER_LABEL[provider];
}

/** Enabled only when the public env flag is the lowercase literal `true`. */
export function isAuthProviderEnabled(provider: OAuthProviderId): boolean {
  return process.env[ENABLED_ENV[provider]] === "true";
}

export function oauthCallbackRedirect(origin: string, nextPath: string): string {
  const next = encodeURIComponent(nextPath);
  return `${origin.replace(/\/$/, "")}/auth/callback?next=${next}`;
}

type OAuthClient = {
  auth: {
    signInWithOAuth: (args: {
      provider: Provider;
      options?: { redirectTo?: string; scopes?: string };
    }) => Promise<{ error: { message: string } | null }>;
  };
};

/**
 * Starts Supabase OAuth (PKCE). Provider tokens stay with Supabase Auth; this app
 * never stores provider access tokens for profiling or ads (L7).
 */
export async function startOAuthSignIn(
  client: OAuthClient,
  provider: OAuthProviderId,
  redirectTo: string,
): Promise<{ started: boolean; error: string | null }> {
  if (!isAuthProviderEnabled(provider)) {
    return { started: false, error: "provider_disabled" };
  }
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      scopes: OAUTH_PROVIDER_SCOPES[provider],
    },
  });
  if (error) {
    return { started: false, error: error.message };
  }
  return { started: true, error: null };
}

export type LinkedIdentity = {
  id: string;
  provider: string;
  identity_id: string;
  email?: string;
};

/** Keep at least one linked identity (sign-in method). */
export function canUnlinkIdentity(identities: LinkedIdentity[]): boolean {
  return identities.length > 1;
}
