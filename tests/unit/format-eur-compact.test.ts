import { describe, expect, it } from "vitest";
import { formatEurCompact } from "@/lib/format-eur-compact";

describe("formatEurCompact", () => {
  it("shows full amount under €10k without decimals", () => {
    expect(formatEurCompact(999_900, "en")).toMatch(/9,?999/);
  });

  it("uses compact notation for large amounts", () => {
    const formatted = formatEurCompact(125_000_00, "en");
    expect(formatted.toLowerCase()).toMatch(/125/);
    expect(formatted).toMatch(/€/);
  });
});