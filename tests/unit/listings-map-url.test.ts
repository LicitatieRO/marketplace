import { describe, expect, it } from "vitest";
import {
  listingsMapSearchParams,
  parseListingsMapBboxParam,
  parseListingsMapListingId,
  parseListingsMapView,
} from "@/lib/listings-map-url";

const bbox = { west: 25, south: 44, east: 27, north: 46 };
const fallback = { west: 20.11, south: 43.47, east: 30.2, north: 48.42 };

describe("listingsMapSearchParams", () => {
  it("writes view=map when mobile map view is active", () => {
    const params = listingsMapSearchParams({
      listingId: "20000000-0000-4000-8000-000000000001",
      bbox,
      mobileView: "map",
    });
    expect(params.get("view")).toBe("map");
    expect(params.get("listing")).toBe("20000000-0000-4000-8000-000000000001");
    expect(params.get("bbox")).toBe("25,44,27,46");
  });

  it("removes view and listing when cleared", () => {
    const params = listingsMapSearchParams({
      listingId: null,
      bbox,
      mobileView: "list",
      existing: new URLSearchParams("view=map&listing=abc&foo=1"),
    });
    expect(params.get("view")).toBeNull();
    expect(params.get("listing")).toBeNull();
    expect(params.get("foo")).toBe("1");
  });

  it("drops invalid listing ids instead of reflecting them", () => {
    const params = listingsMapSearchParams({
      listingId: '"><script>',
      bbox,
      mobileView: "list",
    });
    expect(params.get("listing")).toBeNull();
  });
});

describe("parseListingsMapView", () => {
  it("allowlists view param values", () => {
    expect(parseListingsMapView(new URLSearchParams("view=map"))).toBe("map");
    expect(parseListingsMapView(new URLSearchParams())).toBe("list");
    expect(
      parseListingsMapView(new URLSearchParams('view="><img src=x>')),
    ).toBe("list");
  });
});

describe("parseListingsMapListingId", () => {
  it("accepts uuid-shaped ids and rejects markup", () => {
    expect(
      parseListingsMapListingId("20000000-0000-4000-8000-000000000001"),
    ).toBe("20000000-0000-4000-8000-000000000001");
    expect(parseListingsMapListingId('"><img src=x>')).toBeNull();
  });
});

describe("parseListingsMapBboxParam", () => {
  it("returns fallback on malformed bbox strings", () => {
    expect(parseListingsMapBboxParam("not-a-bbox", fallback)).toEqual(fallback);
    expect(parseListingsMapBboxParam("1,2,NaN,4", fallback)).toEqual(fallback);
  });

  it("clamps finite bbox components to Romania bounds", () => {
    const parsed = parseListingsMapBboxParam("0,0,50,50", fallback);
    expect(parsed.west).toBeGreaterThanOrEqual(fallback.west);
    expect(parsed.north).toBeLessThanOrEqual(fallback.north);
    expect(parsed.east).toBeGreaterThan(parsed.west);
    expect(parsed.north).toBeGreaterThan(parsed.south);
  });
});
