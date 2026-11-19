import { describe, expect, it } from "vitest";
import {
  assertSameOrigin,
  buildAccountSignInUrl,
  safeReturnPath,
} from "@/lib/security";
import { parseMutation } from "@/lib/validation";
const listingId = "20000000-0000-4000-8000-000000000001";
describe("request security", () => {
  it("rejects browser writes from a foreign origin", () => {
    expect(() =>
      assertSameOrigin(
        new Headers({ origin: "https://evil.example" }),
        "https://licitatiero.ro",
      ),
    ).toThrow();
  });
  it("rejects writes missing an Origin", () => {
    expect(() =>
      assertSameOrigin(new Headers(), "https://licitatiero.ro"),
    ).toThrow();
  });
  it("accepts same origin despite paths", () => {
    expect(() =>
      assertSameOrigin(
        new Headers({ origin: "https://licitatiero.ro" }),
        "https://licitatiero.ro/path",
      ),
    ).not.toThrow();
  });
  it("never follows protocol relative return URLs", () => {
    expect(safeReturnPath("//evil.example")).toBe("/workspace");
    expect(safeReturnPath("/workspace?tab=offers")).toBe(
      "/workspace?tab=offers",
    );
  });
});
describe("safeReturnPath allowlist", () => {
  it("rejects absolute and encoded open redirects", () => {
    expect(safeReturnPath("https://evil.example")).toBe("/workspace");
    expect(safeReturnPath("/\\evil")).toBe("/workspace");
    expect(safeReturnPath("/%2f%2fevil.example")).toBe("/workspace");
    expect(safeReturnPath("%2f%2fevil.example")).toBe("/workspace");
  });
  it("rejects api, auth, and empty values", () => {
    expect(safeReturnPath("/api/health")).toBe("/workspace");
    expect(safeReturnPath("/auth/callback")).toBe("/workspace");
    expect(safeReturnPath("")).toBe("/workspace");
    expect(safeReturnPath(null)).toBe("/workspace");
  });
  it("accepts listing, workspace, account, founder, and legal paths", () => {
    expect(safeReturnPath(`/listings/${listingId}`)).toBe(
      `/listings/${listingId}`,
    );
    expect(safeReturnPath("/account?mode=reset")).toBe("/account?mode=reset");
    expect(safeReturnPath("/legal/privacy")).toBe("/legal/privacy");
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath(undefined, `/listings/${listingId}`)).toBe(
      `/listings/${listingId}`,
    );
  });
  it("builds encoded sign-in URLs", () => {
    expect(buildAccountSignInUrl(`/listings/${listingId}`)).toBe(
      `/account?mode=login&next=${encodeURIComponent(`/listings/${listingId}`)}`,
    );
  });
});
describe("marketplace inputs", () => {
  it("rejects monetary fractions and unexpected identity fields", () => {
    expect(() =>
      parseMutation({
        action: "place_bid",
        payload: {
          p_auction_id: "10000000-0000-4000-8000-000000000001",
          p_amount_minor: 1.5,
          p_idempotency_key: "10000000-0000-4000-8000-000000000002",
        },
      }),
    ).toThrow();
    expect(() =>
      parseMutation({
        action: "place_bid",
        payload: { p_user_id: "admin" },
      }),
    ).toThrow();
  });
  it("requires one positive property price", () => {
    expect(() =>
      parseMutation({
        action: "create_property",
        payload: {
          p_title: "Apartment",
          p_description: "A sufficiently detailed property description.",
          p_neighborhood: "Cotroceni",
          p_exact_address: "Private address",
          p_property_type: "apartment",
          p_area_sqm: 60,
          p_rooms: 2,
          p_floor: 1,
          p_built_year: 2000,
          p_sale_price_minor: null,
          p_rent_price_minor: null,
          p_image_urls: [],
        },
      }),
    ).toThrow();
  });
  it("rejects active markup URLs in property pictures", () => {
    expect(() =>
      parseMutation({
        action: "create_property",
        payload: {
          p_title: "Apartment",
          p_description: "A sufficiently detailed property description.",
          p_neighborhood: "Cotroceni",
          p_exact_address: "Private address",
          p_property_type: "apartment",
          p_area_sqm: 60,
          p_rooms: 2,
          p_floor: 1,
          p_built_year: 2000,
          p_sale_price_minor: 100000,
          p_rent_price_minor: null,
          p_image_urls: ["javascript:alert(1)"],
        },
      }),
    ).toThrow();
  });
  it("accepts a valid integer-valued bid and preserves the retry key", () => {
    const v = {
      action: "place_bid",
      payload: {
        p_auction_id: "10000000-0000-4000-8000-000000000001",
        p_amount_minor: 1234500,
        p_idempotency_key: "10000000-0000-4000-8000-000000000002",
      },
    };
    expect(parseMutation(v)).toEqual(v);
  });
});
describe("database-compatible input limits", () => {
  const draft = {
    p_title: "Apartment",
    p_description: "A sufficiently detailed property description.",
    p_neighborhood: "Cotroceni",
    p_exact_address: "Private address",
    p_property_type: "apartment",
    p_area_sqm: 60,
    p_rooms: 2,
    p_floor: 1,
    p_built_year: 2000,
    p_sale_price_minor: 100000,
    p_rent_price_minor: null,
    p_image_urls: [],
  };
  it("rejects text exceeding the database description limit", () => {
    expect(() =>
      parseMutation({
        action: "create_property",
        payload: { ...draft, p_description: "a".repeat(5001) },
      }),
    ).toThrow();
  });
  it("rejects more than twelve approved images", () => {
    expect(() =>
      parseMutation({
        action: "create_property",
        payload: {
          ...draft,
          p_image_urls: Array(13).fill(
            "https://images.unsplash.com/photo-example",
          ),
        },
      }),
    ).toThrow();
  });
  it("rejects messages exceeding the database limit", () => {
    expect(() =>
      parseMutation({
        action: "send_message",
        payload: {
          p_listing_id: "20000000-0000-4000-8000-000000000001",
          p_body: "a".repeat(3001),
        },
      }),
    ).toThrow();
  });
});