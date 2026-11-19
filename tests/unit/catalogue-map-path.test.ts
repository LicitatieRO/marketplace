import { describe, expect, it } from "vitest";
import {
  buildMapPathFromCatalogueFilters,
  hasCatalogueMapFilters,
  parseCatalogueMapFilters,
} from "@/lib/catalogue-map-path";
import {
  defaultCatalogueNeighborhoodAllowlist,
  sanitizeCatalogueMapFilters,
} from "@/lib/catalogue-map-filter-sanitize";
import { applyCatalogueFiltersToMapListings } from "@/lib/map-listing-catalogue-filters";
import type { MapListing } from "@/lib/map-listing-types";

const sampleListing: MapListing = {
  id: "a",
  auctionId: null,
  slug: "a",
  title: "Apartament Floreasca",
  sector: "București",
  neighbourhood: "Floreasca",
  approxLat: 44.46,
  approxLng: 26.09,
  photoUrl: null,
  currentBidCents: 250_000_00,
  minIncrementCents: 1_000_00,
  startsAt: null,
  endsAt: null,
  status: "live",
};

describe("catalogue-map-path", () => {
  it("builds /map without default sale transaction", () => {
    expect(
      buildMapPathFromCatalogueFilters({ transaction: "sale" }),
    ).toBe("/map");
  });

  it("serializes active catalogue filters", () => {
    const path = buildMapPathFromCatalogueFilters({
      transaction: "rent",
      neighborhood: "Floreasca",
      maxPrice: "350000",
      q: "2 cam",
    });
    expect(path.startsWith("/map?")).toBe(true);
    const params = new URLSearchParams(path.slice(path.indexOf("?") + 1));
    expect(params.get("transaction")).toBe("rent");
    expect(params.get("neighborhood")).toBe("Floreasca");
    expect(params.get("maxPrice")).toBe("350000");
    expect(params.get("q")).toBe("2 cam");
  });

  it("round-trips query params", () => {
    const params = new URLSearchParams(
      "transaction=rent&neighborhood=Floreasca&q=test",
    );
    expect(parseCatalogueMapFilters(params)).toEqual({
      transaction: "rent",
      neighborhood: "Floreasca",
      q: "test",
    });
    expect(
      hasCatalogueMapFilters(parseCatalogueMapFilters(params)),
    ).toBe(true);
  });
});

describe("catalogue-map-filter-sanitize", () => {
  it("drops unknown neighbourhoods and clamps max price", () => {
    const allowlist = defaultCatalogueNeighborhoodAllowlist();
    expect(
      sanitizeCatalogueMapFilters(
        {
          neighborhood: "<script>",
          maxPrice: "99999999999",
          transaction: "invalid",
        },
        allowlist,
      ),
    ).toEqual({ maxPrice: "10000000" });
    expect(
      sanitizeCatalogueMapFilters(
        { neighborhood: "Floreasca", rooms: "99" },
        allowlist,
      ),
    ).toEqual({ neighborhood: "Floreasca" });
  });
});

describe("map-listing-catalogue-filters", () => {
  it("filters map listings by neighbourhood and max price", () => {
    const result = applyCatalogueFiltersToMapListings([sampleListing], {
      neighborhood: "Floreasca",
      maxPrice: "200000",
    });
    expect(result).toHaveLength(0);

    const withinBudget = applyCatalogueFiltersToMapListings([sampleListing], {
      maxPrice: "400000",
      q: "floreasca",
    });
    expect(withinBudget).toHaveLength(1);
  });

  it("filters by transaction and minimum rooms", () => {
    const sale = { ...sampleListing, id: "sale", transactionType: "sale" as const, rooms: 3 };
    const rent = {
      ...sampleListing,
      id: "rent",
      transactionType: "rent" as const,
      rooms: 2,
    };
    const result = applyCatalogueFiltersToMapListings([sale, rent], {
      transaction: "rent",
      rooms: "3",
    });
    expect(result.map((item) => item.id)).toEqual([]);
    const roomsOk = applyCatalogueFiltersToMapListings([sale, rent], {
      rooms: "2",
    });
    expect(roomsOk.map((item) => item.id).sort()).toEqual(["rent", "sale"]);
  });
});
