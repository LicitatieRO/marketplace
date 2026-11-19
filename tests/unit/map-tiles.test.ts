import { describe, expect, it } from "vitest";
import { demoListings } from "@/lib/fixtures";
import { ROMANIA_BBOX } from "@/lib/geo-bounds";
import {
  DEFAULT_MAP_TILE_ATTRIBUTION,
  DEFAULT_MAP_TILE_URL,
  isAllowedMapTileTemplate,
  mapTileAttribution,
  mapTileUrlTemplate,
  resolveMapSurface,
} from "@/lib/map-tiles";

describe("map tile consent gate", () => {
  it("defaults to the exact OSM tile URL without subdomains", () => {
    expect(mapTileUrlTemplate()).toBe(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    );
    expect(DEFAULT_MAP_TILE_URL).toBe(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    );
    expect(DEFAULT_MAP_TILE_URL).not.toContain("{s}");
  });

  it("exposes OSM copyright attribution by default", () => {
    const attribution = mapTileAttribution();
    expect(attribution).toContain("openstreetmap.org/copyright");
    expect(attribution).toContain("OpenStreetMap");
    expect(DEFAULT_MAP_TILE_ATTRIBUTION).toContain("contributors");
  });

  it("rejects non-https or non-allowlisted tile URL overrides", () => {
    const env = process.env;
    process.env = {
      ...env,
      NEXT_PUBLIC_MAP_TILE_URL: "http://tile.openstreetmap.org/{z}/{x}/{y}.png",
    };
    expect(isAllowedMapTileTemplate(process.env.NEXT_PUBLIC_MAP_TILE_URL!)).toBe(
      false,
    );
    expect(mapTileUrlTemplate()).toBe(DEFAULT_MAP_TILE_URL);
    process.env.NEXT_PUBLIC_MAP_TILE_URL =
      "https://tiles.example.com/{z}/{x}/{y}.png";
    expect(mapTileUrlTemplate()).toBe(DEFAULT_MAP_TILE_URL);
    process.env = env;
  });

  it("falls back when attribution override drops OSM credit", () => {
    const env = process.env;
    process.env = {
      ...env,
      NEXT_PUBLIC_MAP_TILE_ATTRIBUTION: "© Example Corp",
    };
    expect(mapTileAttribution()).toBe(DEFAULT_MAP_TILE_ATTRIBUTION);
    process.env = env;
  });

  it("does not expose interactive map surface until optional content is allowed", () => {
    expect(resolveMapSurface(false)).toBe("placeholder");
    expect(resolveMapSurface(true)).toBe("interactive");
  });
});

describe("bucharest demo fixture alignment", () => {
  it("has six properties and twelve listings with in-bounds coords", () => {
    const propertyIds = new Set(demoListings.map((l) => l.property_id));
    expect(propertyIds.size).toBe(6);
    expect(demoListings).toHaveLength(12);
    const sale = demoListings.filter((l) => l.transaction_type === "sale");
    const rent = demoListings.filter((l) => l.transaction_type === "rent");
    expect(sale).toHaveLength(6);
    expect(rent).toHaveLength(6);

    for (const listing of demoListings) {
      expect(listing.lat).toBeGreaterThanOrEqual(ROMANIA_BBOX.minLat);
      expect(listing.lat).toBeLessThanOrEqual(ROMANIA_BBOX.maxLat);
      expect(listing.lng).toBeGreaterThanOrEqual(ROMANIA_BBOX.minLng);
      expect(listing.lng).toBeLessThanOrEqual(ROMANIA_BBOX.maxLng);
    }

    expect(
      demoListings.find((l) => l.property_id.endsWith("000001"))?.price_minor,
    ).toBe(25900000);
    expect(
      demoListings.find(
        (l) => l.id === "40000000-0000-4000-8000-000000000001",
      ),
    ).toBeUndefined();
    expect(
      demoListings.find(
        (l) =>
          l.property_id.endsWith("000001") &&
          l.transaction_type === "sale" &&
          l.auction_id,
      )?.auction_id,
    ).toBe("40000000-0000-4000-8000-000000000001");
  });
});