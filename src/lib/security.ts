import { isAllowedMapNextPath } from "./map-next-path";

export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
  ) {
    super(message);
  }
}
export function assertSameOrigin(headers: Headers, expected: string): void {
  const origin = headers.get("origin");
  if (
    !origin ||
    origin !== new URL(expected).origin ||
    headers.get("sec-fetch-site") === "cross-site"
  )
    throw new RequestError("Cross-origin request rejected.", 403);
}
const ALLOWED_LEGAL = new Set([
  "/legal/terms",
  "/legal/privacy",
  "/legal/cookies",
]);
const LISTING_PATH =
  /^\/listings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function pathnameOnly(value: string): string {
  const q = value.indexOf("?");
  return q === -1 ? value : value.slice(0, q);
}
function rawLooksMalicious(raw: string): boolean {
  return /%2f%2f|%5c|%2F%2F|%5C/i.test(raw);
}
function isAllowedReturnPath(decoded: string): boolean {
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return false;
  if (/[\\\x00-\x1f]/.test(decoded)) return false;
  const pathOnly = pathnameOnly(decoded);
  if (pathOnly.includes("//") || pathOnly.includes("\\")) return false;
  if (
    pathOnly.startsWith("/api/") ||
    pathOnly.startsWith("/auth/") ||
    pathOnly.startsWith("/_next/")
  )
    return false;
  if (pathOnly === "/") return true;
  if (pathOnly === "/map") return isAllowedMapNextPath(decoded);
  if (LISTING_PATH.test(pathOnly)) return true;
  if (pathOnly === "/workspace") return true;
  if (pathOnly === "/saved-searches") return true;
  if (pathOnly === "/account") return true;
  if (pathOnly === "/founder" || pathOnly.startsWith("/founder/")) return true;
  if (ALLOWED_LEGAL.has(pathOnly)) return true;
  return false;
}
export function safeReturnPath(
  value: string | null | undefined,
  redirectTo?: string | null,
): string {
  const candidate = value ?? redirectTo ?? null;
  if (!candidate) return "/workspace";
  if (rawLooksMalicious(candidate)) return "/workspace";
  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return "/workspace";
  }
  if (rawLooksMalicious(decoded)) return "/workspace";
  if (!isAllowedReturnPath(decoded)) return "/workspace";
  return decoded;
}
export function buildAccountSignInUrl(
  returnTo: string,
  mode: "login" | "signup" = "login",
): string {
  const safe = safeReturnPath(returnTo);
  return `/account?mode=${mode}&next=${encodeURIComponent(safe)}`;
}
export function requestOrigin(requestUrl: string): string {
  const configured =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!configured && process.env.NODE_ENV === "production")
    throw new RequestError("APP_URL must be configured.", 503);
  const url = new URL(configured || requestUrl);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  )
    throw new RequestError("HTTPS application origin required.", 503);
  return url.origin;
}
