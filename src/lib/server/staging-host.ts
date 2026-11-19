/** Exact hostnames only (no subdomain/wildcard suffix matching); port is stripped before compare. */
export const STAGING_HOST_ALLOWLIST = [
  "licitatiero-staging.vercel.app",
  "localhost",
  "127.0.0.1",
] as const;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function vercelEnvUnsetOrEmpty(): boolean {
  const value = process.env.VERCEL_ENV?.trim();
  return !value;
}

export function isProductionRuntime(): boolean {
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  if (vercelEnv === "production") return true;
  if (vercelEnvUnsetOrEmpty() && process.env.NODE_ENV === "production") return true;
  return false;
}

export function normalizeHostname(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("://")) {
    try {
      const hostname = new URL(trimmed).hostname;
      return hostname || null;
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("[")) {
    const close = trimmed.indexOf("]");
    if (close <= 1) return null;
    return trimmed.slice(1, close) || null;
  }
  const hostPart = trimmed.split(":")[0]?.trim();
  return hostPart || null;
}

export function requestHostProvided(
  requestHost: string | null | undefined,
): boolean {
  if (requestHost === undefined || requestHost === null) return false;
  return requestHost.trim() !== "";
}

export function configuredAppHostname(): string | null {
  return normalizeHostname(readEnv("APP_URL") ?? null);
}

export function hostnameInStagingAllowlist(hostname: string | null): boolean {
  if (!hostname) return false;
  return (STAGING_HOST_ALLOWLIST as readonly string[]).includes(hostname);
}

export function stagingHostAllowed(
  appUrlHost: string | null,
  requestHost: string | null | undefined,
): boolean {
  if (!hostnameInStagingAllowlist(appUrlHost)) return false;
  if (!requestHostProvided(requestHost)) return false;
  if (!hostnameInStagingAllowlist(normalizeHostname(requestHost))) return false;
  return true;
}

export function stagingHostsAllowlistedForRequest(
  requestHost: string | null | undefined,
): boolean {
  return stagingHostAllowed(configuredAppHostname(), requestHost);
}

/** Staging notification outbox on production: configured APP_URL must be allowlisted; optional request Host must match when present. */
export function stagingOutboxProductionHostAllowedForConfiguredApp(
  appUrlHost: string | null,
  requestHost: string | null | undefined,
): boolean {
  if (!hostnameInStagingAllowlist(appUrlHost)) return false;
  if (requestHostProvided(requestHost)) {
    return hostnameInStagingAllowlist(normalizeHostname(requestHost));
  }
  return true;
}

export function stagingOutboxProductionHostAllowed(
  requestHost: string | null | undefined,
): boolean {
  return stagingOutboxProductionHostAllowedForConfiguredApp(
    configuredAppHostname(),
    requestHost,
  );
}

/** True when configured APP_URL hostname is an approved staging host (not request Host alone). */
export function isStagingHost(): boolean {
  return hostnameInStagingAllowlist(configuredAppHostname());
}

/** Founder notification outbox UI/API: staging hosts only. */
export function founderOutboxRouteAllowed(
  requestHost: string | null | undefined,
): boolean {
  if (!isStagingHost()) return false;
  if (!isProductionRuntime()) return true;
  if (!requestHostProvided(requestHost)) return false;
  return hostnameInStagingAllowlist(normalizeHostname(requestHost));
}