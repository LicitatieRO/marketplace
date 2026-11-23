import 'server-only';
import { isIP } from 'node:net';

const LOCAL_FALLBACK = '127.0.0.1';
const IPV4_MAPPED_PREFIX = '::ffff:';
let warnedMissingTrustedIp = false;

function stripIpv6ZoneId(value: string): string {
  const zone = value.indexOf('%');
  return zone >= 0 ? value.slice(0, zone) : value;
}

/** Strip `[host]:port` down to `host` when brackets denote an IPv6 literal. */
function hostFromBracketed(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('[')) return trimmed;
  const close = trimmed.indexOf(']');
  if (close < 0) return trimmed;
  const suffix = trimmed.slice(close + 1);
  if (suffix === '' || suffix.startsWith(':')) {
    return trimmed.slice(1, close);
  }
  return trimmed;
}

function hasLeadingZeroIpv4Octet(value: string): boolean {
  if (!value.includes('.') || value.includes(':')) return false;
  return value.split('.').some((octet) => octet.length > 1 && octet.startsWith('0'));
}

function unmapIpv4Mapped(value: string): string {
  const lower = value.toLowerCase();
  if (lower.startsWith(IPV4_MAPPED_PREFIX)) {
    const tail = value.slice(IPV4_MAPPED_PREFIX.length);
    if (isIP(tail) === 4) return tail;
  }
  if (isIP(value) === 6) {
    const groups = expandIpv6Hextets(value);
    if (
      groups &&
      groups.slice(0, 5).every((part) => part === '0000') &&
      groups[5] === 'ffff'
    ) {
      const hi = parseInt(groups[6]!, 16);
      const lo = parseInt(groups[7]!, 16);
      const mapped = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      if (isIP(mapped) === 4) return mapped;
    }
  }
  return value;
}

/** Normalize proxy client IP values; invalid inputs become null. */
export function normalizeClientIp(raw: string): string | null {
  let value = stripIpv6ZoneId(hostFromBracketed(raw));
  if (!value) return null;
  if (hasLeadingZeroIpv4Octet(value)) return null;
  if (isIP(value) === 0) return null;
  value = unmapIpv4Mapped(value);
  if (isIP(value) === 0) return null;
  if (hasLeadingZeroIpv4Octet(value)) return null;
  return value;
}

function validatedIp(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return normalizeClientIp(trimmed);
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
  const normalized = normalizeClientIp(ip.trim()) ?? ip.trim();
  const version = isIP(normalized);
  if (version === 4) return normalized;
  if (version !== 6) return normalized;
  const groups = expandIpv6Hextets(normalized);
  if (!groups) return normalized;
  return `${groups.slice(0, 4).join(':')}::/64`;
}

/** Trusted client IP for rate limits. On Vercel prefers x-real-ip, then first x-forwarded-for hop. */
export function trustedClientIp(headers: Headers): string | null {
  if (process.env.VERCEL) {
    const realIp = validatedIp(headers.get('x-real-ip'));
    if (realIp) return realIp;
    return validatedIp(firstForwardedHop(headers));
  }
  const forwarded = validatedIp(firstForwardedHop(headers));
  if (forwarded) return forwarded;
  if (process.env.NODE_ENV !== 'production') return LOCAL_FALLBACK;
  return null;
}

/** Returns a syntactically valid IPv4/IPv6 string, or null (skip per-IP rate bucket). */
export function parseableClientIp(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return normalizeClientIp(trimmed);
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
