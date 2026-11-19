import { describe, expect, it } from "vitest";
import { auctionClockPhase } from "@/lib/listing-auction-clock";

const starts = "2099-01-01T12:00:00.000Z";
const ends = "2099-01-02T12:00:00.000Z";

describe("auctionClockPhase", () => {
  it("returns loading when the client clock has not initialized", () => {
    expect(auctionClockPhase(0, starts, ends)).toBe("loading");
  });

  it("classifies scheduled, live, and ended from timestamps", () => {
    const beforeStart = new Date(starts).getTime() - 60_000;
    const during = new Date(starts).getTime() + 60_000;
    const afterEnd = new Date(ends).getTime() + 60_000;
    expect(auctionClockPhase(beforeStart, starts, ends)).toBe("scheduled");
    expect(auctionClockPhase(during, starts, ends)).toBe("live");
    expect(auctionClockPhase(afterEnd, starts, ends)).toBe("ended");
  });
});