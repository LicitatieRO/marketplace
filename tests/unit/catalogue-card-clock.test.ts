import { describe, expect, it } from "vitest";
import {
  catalogueCardTimeParts,
  deriveListingAuctionStatus,
} from "@/lib/catalogue-card-clock";

const listing = {
  auction_id: "40000000-0000-4000-8000-000000000001",
  starts_at: "2026-11-20T10:00:00.000Z",
  ends_at: "2026-11-23T18:00:00.000Z",
};

describe("deriveListingAuctionStatus", () => {
  it("returns live inside the auction window", () => {
    expect(
      deriveListingAuctionStatus(
        listing,
        Date.parse("2026-11-22T12:00:00.000Z"),
      ),
    ).toBe("live");
  });

  it("formats live countdown parts for catalogue cards", () => {
    const now = Date.parse("2026-11-23T14:00:00.000Z");
    const parts = catalogueCardTimeParts(listing, now, "ro");
    expect(parts?.text).toMatch(/\d+z \d+h/);
    expect(parts?.urgent).toBe(false);
  });

  it("marks under one hour as urgent", () => {
    const now = Date.parse("2026-11-23T17:30:00.000Z");
    const parts = catalogueCardTimeParts(listing, now, "en");
    expect(parts?.urgent).toBe(true);
    expect(parts?.text).toMatch(/\d+m/);
  });
});
