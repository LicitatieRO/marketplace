import { describe, expect, it } from "vitest";
import type { RepesAuctionEntry } from "@/lib/repes/types";
import loadSynthetic from "@/lib/repes/fixtures/synthetic-auctions.json";
import {
  filterBucharestIlfovRepesEntries,
  isBucharestIlfovCounty,
  isBucharestIlfovRepesEntry,
} from "@/lib/repes/region-filter";

const entries = (loadSynthetic as { entries: RepesAuctionEntry[] }).entries;

describe("Bucharest/Ilfov REPES filter", () => {
  it("matches judet spelling variants", () => {
    expect(isBucharestIlfovCounty("București")).toBe(true);
    expect(isBucharestIlfovCounty("BUCURESTI")).toBe(true);
    expect(isBucharestIlfovCounty("Ilfov")).toBe(true);
    expect(isBucharestIlfovCounty("Timiș")).toBe(false);
  });

  it("keeps Bucharest/Ilfov rows across all asset classes", () => {
    const filtered = filterBucharestIlfovRepesEntries(entries);
    expect(filtered).toHaveLength(5);
    expect(filtered.every(isBucharestIlfovRepesEntry)).toBe(true);
  });

  it("excludes other counties", () => {
    const otherCounty: RepesAuctionEntry = {
      ...entries[0],
      asset: {
        ...entries[0].asset!,
        type: "AUT",
        category: "CAR",
        address: { city: "Timisoara", county: "Timis" },
      },
    };
    expect(isBucharestIlfovRepesEntry(otherCounty)).toBe(false);
  });
});
