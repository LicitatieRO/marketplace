import { describe, expect, it } from "vitest";
import { buildAccountSignInUrl, safeReturnPath } from "@/lib/security";
import {
  authBidIntentNotice,
  buildLoginBidIntentUrl,
  classifyPostAuthDestination,
  postAuthCtaLabel,
  resolveAuthIntent,
  shouldRedirectAfterAuth,
} from "@/lib/auth-return";

const listingId = "20000000-0000-4000-8000-000000000001";
const listingPath = `/listings/${listingId}`;
const mapCardPath = `/map?listing=${listingId}&intent=bid`;

describe("auth return paths (#121)", () => {
  it("preserves validated next= through login redirect query", () => {
    const next = encodeURIComponent(mapCardPath);
    expect(`/login?next=${next}`).toContain(encodeURIComponent("intent=bid"));
    expect(safeReturnPath(mapCardPath)).toBe(mapCardPath);
  });

  it("builds listing login URL with bid intent", () => {
    const url = buildLoginBidIntentUrl(listingPath);
    expect(url).toBe(
      `/login?next=${encodeURIComponent(listingPath)}&intent=bid`,
    );
    expect(resolveAuthIntent(listingPath, "bid")).toBe("bid");
  });

  it("rejects open-redirect variants in safeReturnPath", () => {
    expect(safeReturnPath("//evil.example")).toBe("/workspace");
    expect(safeReturnPath("/\\evil")).toBe("/workspace");
    expect(safeReturnPath("/%2f%2fevil.example")).toBe("/workspace");
    expect(safeReturnPath("%2f%2fevil.example")).toBe("/workspace");
  });

  it("resolves intent=bid from query param and from next path", () => {
    expect(resolveAuthIntent(mapCardPath, null)).toBe("bid");
    expect(resolveAuthIntent("/map", "bid")).toBe("bid");
    expect(resolveAuthIntent(listingPath, null)).toBeNull();
  });

  it("labels post-auth CTA by destination", () => {
    expect(classifyPostAuthDestination("/workspace")).toBe("workspace");
    expect(classifyPostAuthDestination(listingPath)).toBe("listing");
    expect(classifyPostAuthDestination("/map")).toBe("map");
    expect(classifyPostAuthDestination(mapCardPath)).toBe("map-listing");
    expect(postAuthCtaLabel.listing.ro).toBe("Înapoi la anunț");
    expect(postAuthCtaLabel["map-listing"].ro).toBe("Înapoi la hartă");
    expect(postAuthCtaLabel.workspace.ro).toBe("Mergi în spațiul tău");
  });

  it("includes bilingual bid-intent notice copy", () => {
    expect(authBidIntentNotice.ro).toMatch(/nu se trimite automat/i);
    expect(authBidIntentNotice.en).toMatch(/not submitted automatically/i);
  });

  it("redirects after login always; after signup only with a session", () => {
    expect(shouldRedirectAfterAuth("login", false)).toBe(true);
    expect(shouldRedirectAfterAuth("signup", true)).toBe(true);
    expect(shouldRedirectAfterAuth("signup", false)).toBe(false);
    expect(shouldRedirectAfterAuth("recover", true)).toBe(false);
  });

  it("buildAccountSignInUrl keeps allowlisted listing paths", () => {
    expect(buildAccountSignInUrl(listingPath)).toBe(
      `/account?mode=login&next=${encodeURIComponent(listingPath)}`,
    );
  });
});