const MAP_LISTING_PATH =
  /^\/map(\?listing=[0-9a-f-]{36}([&?][^#]*)?)?$/i;

export function isAllowedMapNextPath(decoded: string): boolean {
  if (!decoded.startsWith("/")) return false;
  const pathOnly = decoded.includes("?")
    ? decoded.slice(0, decoded.indexOf("?"))
    : decoded;
  if (pathOnly !== "/map") return false;
  if (decoded.includes("//") || decoded.includes("\\")) return false;
  return MAP_LISTING_PATH.test(decoded) || decoded === "/map";
}