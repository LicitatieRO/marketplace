import 'server-only';
import { isIP } from 'node:net';

const LOCAL_FALLBACK = '127.0.0.1';
let warnedMissingTrustedIp = false;

function validatedIp(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed || isIP(trimmed) === 0) return null;
  return trimmed;
}

function firstForwardedHop(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded) return null;
  return forwarded.split(',')[0]?.trim() ?? null;
}

function expandIpv6Hextets(address: string): string[] | null {
  if (isIP(address) !== 6) return null;
  let value = address.toLowerCase();
  const zone = value.indexOf('%');
  if (zone >= 0) value = value.slice(0, zone);

  const [head, tail = ''] = value.split('::');
  if (value.split('::').length > 2) return null;

  const left = head ? head.split(':').filter((part) => part.length > 0) : [];
  const right = tail ? tail.split(':').filter((part) => part.length > 0) : [];

  const embedIpv4 = (parts: string[]): string[] => {
    if (parts.length === 0) return parts;
    const last = parts[parts.length - 1]!;
    if (!last.includes('.')) return parts;
    const octets = last.split('.').map((piece) => Number(piece));
    if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
      return parts;
    }
    const hi = ((octets[0]! << 8) | octets[1]!).toString(16);
    const lo = ((octets[2]! << 8) | octets[3]!).toString(16);
    return [...parts.slice(0, -1), hi, lo];
  };

  const leftExpanded = embedIpv4(left);
  const rightExpanded = embedIpv4(right);
  const missing = 8 - leftExpanded.length - rightExpanded.length;
  if (missing < 0) return null;
  const full = [...leftExpanded, ...Array.from({ length: missing }, () => '0'), ...rightExpanded];
  if (full.length !== 8) return null;
  return full.map((part) => part.padStart(4, '0'));
}

/** Collapse IPv6 to a /64 prefix for stable rate-limit hashing; IPv4 addresses are unchanged. */
export function rateLimitIpKeyMaterial(ip: string): string {
  const trimmed = ip.trim();
  const version = isIP(trimmed);
  if (version === 4) return trimmed;
  if (version !== 6) return trimmed;
  const groups = expandIpv6Hextets(trimmed);
  if (!groups) return trimmed;
  return `${groups.slice(0, 4).join(':')}::/64`;
}

/** Trusted client IP for rate limits. On Vercel prefers x-real-ip, then first x-forwarded-for hop. */
export function trustedClientIp(headers: Headers): string | null {
  if (process.env.VERCEL) {
    const realIp = validatedIp(headers.get('x-real-ip'));
    if (realIp) return realIp;
    return validatedIp(firstForwardedHop(headers));
  }
  const forwarded = firstForwardedHop(headers);
  if (forwarded) return forwarded;
  if (process.env.NODE_ENV !== 'production') return LOCAL_FALLBACK;
  return null;
}

/** Returns a syntactically valid IPv4/IPv6 string, or null (skip per-IP rate bucket). */
export function parseableClientIp(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed || isIP(trimmed) === 0) return null;
  return trimmed;
}

/** Trusted client IP for MFA verify rate limits; unparseable values become null. */
export function clientIpForMfaRateLimit(headers: Headers): string | null {
  return parseableClientIp(trustedClientIp(headers));
}

/** Log once when the per-IP MFA bucket is skipped (factor limit still applies). */
export function warnMfaVerifyMissingClientIp(): void {
  if (warnedMissingTrustedIp) return;
  warnedMissingTrustedIp = true;
  console.warn(
    'MFA verify rate limit: no trusted client IP; applying per-factor limit only.',
  );
}
