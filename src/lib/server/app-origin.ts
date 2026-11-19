import "server-only";

/** Canonical HTTPS app origin from server config only (never request Host). */
export function configuredSiteOrigin(): string | null {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.username || parsed.password) return null;
    return parsed.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function buildRecoveryCallbackUrl(hashedToken: string): string | null {
  const origin = configuredSiteOrigin();
  if (!origin || !hashedToken) return null;
  const params = new URLSearchParams();
  params.set("token_hash", hashedToken);
  params.set("type", "recovery");
  params.set("next", "/account?mode=reset");
  return `${origin}/auth/callback?${params.toString()}`;
}
