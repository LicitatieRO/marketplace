import {
  configuredAppHostname,
  isProductionRuntime,
  isStagingHost,
  normalizeHostname,
  requestHostProvided,
  stagingHostsAllowlistedForRequest,
} from "@/lib/server/staging-host";

/** Only the lowercase literal `true` enables a gate flag; `TRUE`, `1`, etc. stay off (fail closed). */
export function strictTruthyEnv(name: string): boolean {
  return process.env[name]?.trim() === "true";
}

function stagingSignupLinkFlagEnabled(): boolean {
  return strictTruthyEnv("STAGING_SIGNUP_LINK_ENABLED");
}

function stagingOutboxDeliveryMode(): boolean {
  return process.env.EMAIL_DELIVERY_MODE?.trim() === "staging_outbox";
}

/** Server-only gate for staging sign-up confirmation links in the notification outbox. Fails closed. */
export function isStagingSignupLinkEnabled(
  requestHost: string | null | undefined,
): boolean {
  if (!stagingSignupLinkFlagEnabled() || !stagingOutboxDeliveryMode()) {
    return false;
  }
  if (!isProductionRuntime()) return true;
  if (!configuredAppHostname()) return false;
  if (!requestHostProvided(requestHost)) return false;
  return stagingHostsAllowlistedForRequest(requestHost);
}

type OriginParts = {
  hostname: string;
  port: string;
  protocol: string;
};

function parseOriginUrl(raw: string | undefined): OriginParts | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) return null;
    const hostname = normalizeHostname(parsed.hostname);
    if (!hostname) return null;
    const port =
      parsed.port ||
      (parsed.protocol === "https:" ? "443" : parsed.protocol === "http:" ? "80" : "");
    return { hostname, port, protocol: parsed.protocol };
  } catch {
    return null;
  }
}

function configuredSupabaseAuthOrigin(): OriginParts | null {
  return parseOriginUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function configuredAppOrigin(): OriginParts | null {
  return parseOriginUrl(process.env.APP_URL);
}

function httpLocalhostAllowed(protocol: string, hostname: string | null): boolean {
  if (protocol !== "http:" || !hostname) return false;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return false;
  if (isProductionRuntime()) return false;
  const nodeEnv = process.env.NODE_ENV?.trim();
  return nodeEnv === "development" || nodeEnv === "test" || !nodeEnv;
}

function urlSchemeAllowed(url: URL): boolean {
  if (url.protocol === "https:") return true;
  return httpLocalhostAllowed(url.protocol, normalizeHostname(url.hostname));
}

function originsMatch(url: URL, expected: OriginParts): boolean {
  const hostname = normalizeHostname(url.hostname);
  if (!hostname || hostname !== expected.hostname) return false;
  if (url.username || url.password) return false;
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  return port === expected.port;
}

function signupActionLinkHostAllowed(url: URL): boolean {
  const app = configuredAppOrigin();
  if (app && originsMatch(url, app)) return true;
  const auth = configuredSupabaseAuthOrigin();
  if (auth && originsMatch(url, auth)) return true;
  return false;
}

/** Ensures the action link host, redirect_to, and writer-built redirect target stay on allowlisted hosts. */
export function signupActionLinkAllowed(
  actionLink: string,
  expectedRedirectTo: string,
): boolean {
  const app = configuredAppOrigin();
  if (!app) return false;

  let expected: URL;
  try {
    expected = new URL(expectedRedirectTo);
  } catch {
    return false;
  }
  if (!urlSchemeAllowed(expected) || !originsMatch(expected, app)) return false;

  let parsed: URL;
  try {
    parsed = new URL(actionLink);
  } catch {
    return false;
  }
  if (!urlSchemeAllowed(parsed) || !signupActionLinkHostAllowed(parsed)) return false;

  const redirectRaw = parsed.searchParams.get("redirect_to");
  if (!redirectRaw) return false;
  let redirect: URL;
  try {
    redirect = new URL(redirectRaw);
  } catch {
    return false;
  }
  if (!urlSchemeAllowed(redirect) || !originsMatch(redirect, app)) return false;
  return true;
}

export function assertStagingHostForActionLinkPreview(): void {
  if (!isStagingHost()) {
    throw new Error("Action link previews require staging host");
  }
}