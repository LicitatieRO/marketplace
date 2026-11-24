import { describe, expect, it } from "vitest";
import type { RepesAuctionEntry } from "@/lib/repes/types";
import loadSynthetic from "@/lib/repes/fixtures/synthetic-auctions.json";
import {
  normalizeRepesCategory,
  normalizeRepesEntryCategory,
} from "@/lib/repes/category";

const entries = (loadSynthetic as { entries: RepesAuctionEntry[] }).entries;

describe("REPES category normalisation", () => {
  it("maps IMO and AUT/MAS types to expected buckets", () => {
    expect(normalizeRepesCategory("IMO", "APT")).toBe("real_estate");
    expect(normalizeRepesCategory("AUT", "CAR")).toBe("vehicle");
    expect(normalizeRepesCategory("MAS", "EQP")).toBe("equipment");
    expect(normalizeRepesCategory("DIV", "MISC")).toBe("other");
  });

  it("normalises fixture rows", () => {
    expect(normalizeRepesEntryCategory(entries[0])).toBe("real_estate");
    expect(normalizeRepesEntryCategory(entries[3])).toBe("vehicle");
    expect(normalizeRepesEntryCategory(entries[4])).toBe("equipment");
  });
});
