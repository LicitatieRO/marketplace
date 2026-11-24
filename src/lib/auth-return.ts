const LISTING_PATH =
  /^\/listings\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PostAuthDestination =
  | "workspace"
  | "listing"
  | "map"
  | "map-listing";

export function pathnameOfReturnTo(returnTo: string): string {
  const q = returnTo.indexOf("?");
  return q === -1 ? returnTo : returnTo.slice(0, q);
}

export function resolveAuthIntent(
  returnTo: string,
  intentParam: string | null | undefined,
): "bid" | null {
  if (intentParam === "bid") return "bid";
  const q = returnTo.indexOf("?");
  if (q === -1) return null;
  const query = returnTo.slice(q + 1);
  try {
    const params = new URLSearchParams(query);
    if (params.get("intent") === "bid") return "bid";
  } catch {
    return null;
  }
  return null;
}

export function classifyPostAuthDestination(returnTo: string): PostAuthDestination {
  const pathOnly = pathnameOfReturnTo(returnTo);
  if (pathOnly === "/workspace") return "workspace";
  if (LISTING_PATH.test(pathOnly)) return "listing";
  if (pathOnly === "/map") {
    const q = returnTo.indexOf("?");
    if (q === -1) return "map";
    try {
      const params = new URLSearchParams(returnTo.slice(q + 1));
      if (params.get("listing")?.trim()) return "map-listing";
    } catch {
      /* fall through */
    }
    return "map";
  }
  return "workspace";
}

export const postAuthCtaLabel = {
  workspace: { ro: "Mergi în spațiul tău", en: "Go to your workspace" },
  listing: { ro: "Înapoi la anunț", en: "Back to listing" },
  map: { ro: "Înapoi la hartă", en: "Back to map" },
  "map-listing": { ro: "Înapoi la hartă", en: "Back to map" },
} satisfies Record<PostAuthDestination, { ro: string; en: string }>;

export const authBidIntentNotice = {
  ro: "După autentificare vei reveni la anunț sau la cardul de pe hartă. Oferta nu se trimite automat.",
  en: "After sign-in you’ll return to the listing or map card. Your bid is not submitted automatically.",
};

export function shouldRedirectAfterAuth(
  mode: "login" | "signup" | "recover" | "reset",
  hasSession: boolean,
): boolean {
  if (mode === "login") return true;
  if (mode === "signup") return hasSession;
  return false;
}