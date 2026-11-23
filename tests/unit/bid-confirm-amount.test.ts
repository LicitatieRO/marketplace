import { describe, expect, it } from "vitest";
import { placeBidAmountMinor } from "@/lib/bid-confirm-amount";

describe("placeBidAmountMinor", () => {
  it("uses the confirm snapshot and ignores draft edits", () => {
    expect(placeBidAmountMinor(150_000, 999_000)).toBe(150_000);
  });

  it("returns null when confirm snapshot is missing", () => {
    expect(placeBidAmountMinor(null, 100_000)).toBeNull();
  });
});