import { describe, expect, it } from "vitest";
import {
  formatPricePerSqm,
  pricePerSqmMinor,
} from "@/lib/listing-price-per-sqm";

describe("pricePerSqmMinor", () => {
  it("returns rounded minor units per square metre", () => {
    expect(pricePerSqmMinor(300_000_00, 75)).toBe(4_000_00);
  });

  it("returns null for unusable area", () => {
    expect(pricePerSqmMinor(300_000_00, 0)).toBeNull();
    expect(pricePerSqmMinor(300_000_00, -10)).toBeNull();
  });
});

describe("formatPricePerSqm", () => {
  it("formats sale price per m² in Romanian locale", () => {
    const label = formatPricePerSqm(245_000_00, 65, "ro", "sale");
    expect(label).toMatch(/\/ m²$/);
    expect(label).toMatch(/3\.769/);
  });

  it("formats rent with monthly suffix", () => {
    const label = formatPricePerSqm(1_200_00, 60, "en", "rent");
    expect(label).toBe("€20 / m² / month");
  });

  it("returns null when area is missing", () => {
    expect(formatPricePerSqm(100_000_00, 0, "ro", "sale")).toBeNull();
  });
});