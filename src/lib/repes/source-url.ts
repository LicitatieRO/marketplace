const REPES_SOURCE_HOSTS = new Set([
  "prod.executori.ro",
  "www.executori.ro",
  "executori.ro",
]);

export function isAllowedRepesSourceUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return REPES_SOURCE_HOSTS.has(host);
  } catch {
    return false;
  }
}

export function assertAllowedRepesSourceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!isAllowedRepesSourceUrl(trimmed)) {
    throw new Error("REPES source URL host not allowed");
  }
  return trimmed;
}
