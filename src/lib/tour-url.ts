/** Client-side mirror of embed rules in app.canonical_tour_url / set_property_tour. */
export function safeEmbedTourUrl(tourSource: string | null | undefined): string | null {
  if (!tourSource) return null;
  try {
    const url = new URL(tourSource);
    if (url.protocol !== "https:") return null;
    const kuula =
      ["kuula.co", "www.kuula.co"].includes(url.hostname) &&
      url.pathname.startsWith("/share/");
    const matterport =
      url.hostname === "my.matterport.com" &&
      url.pathname === "/show/" &&
      Boolean(url.searchParams.get("m"));
    if (kuula || matterport) return url.toString();
  } catch {
    /* Invalid provider URLs are never embedded. */
  }
  return null;
}