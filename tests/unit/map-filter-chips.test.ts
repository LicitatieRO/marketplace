import { describe, expect, it } from "vitest";
import { buildMapFilterChips } from "@/lib/map-filter-chips";

const labels = {
  rent: "Rent",
  rooms: (n: string) => `${n} rooms`,
  maxPrice: (n: string) => `Up to €${n}`,
  neighborhood: (n: string) => n,
  query: (q: string) => `“${q}”`,
  propertyType: (t: string) => t,
};

describe("buildMapFilterChips", () => {
  it("returns rent chip when transaction is rent", () => {
    expect(
      buildMapFilterChips({ transaction: "rent" }, labels).map((c) => c.label),
    ).toEqual(["Rent"]);
  });

  it("skips default sale transaction", () => {
    expect(buildMapFilterChips({ transaction: "sale" }, labels)).toEqual([]);
  });

  it("includes neighbourhood and price filters", () => {
    const chips = buildMapFilterChips(
      { neighborhood: "Floreasca", maxPrice: "250000", transaction: "rent" },
      labels,
    );
    expect(chips.map((c) => c.id)).toEqual([
      "transaction",
      "neighborhood",
      "maxPrice",
    ]);
  });
});
