import { describe, expect, it } from "vitest";
import {
  formatMapClusterAriaLabel,
  formatMapPillAriaLabel,
  formatMapTimeLeftLabel,
} from "@/lib/map-listing-time";

const starts = "2099-06-01T10:00:00.000Z";
const ends = "2099-06-03T10:00:00.000Z";
const liveNow = new Date("2099-06-02T09:00:00.000Z").getTime();

describe("formatMapTimeLeftLabel", () => {
  it("shows live countdown prefix", () => {
    const result = formatMapTimeLeftLabel("live", starts, ends, liveNow, "ro");
    expect(result?.text).toMatch(/^Se încheie în /);
    expect(result?.urgent).toBe(false);
  });

  it("marks under-one-hour countdown as urgent", () => {
    const soonEnd = new Date("2099-06-02T09:30:00.000Z").toISOString();
    const now = new Date("2099-06-02T09:10:00.000Z").getTime();
    const result = formatMapTimeLeftLabel("live", starts, soonEnd, now, "en");
    expect(result?.urgent).toBe(true);
    expect(result?.text).toMatch(/^Ends in /);
  });

  it("uses scheduled and ended copy", () => {
    const scheduled = formatMapTimeLeftLabel(
      "scheduled",
      starts,
      ends,
      liveNow,
      "en",
    );
    expect(scheduled?.text).toMatch(/^Starts /);
    const ended = formatMapTimeLeftLabel("ended", starts, ends, liveNow, "ro");
    expect(ended?.text).toBe("Licitație încheiată");
  });
});

describe("formatMapPillAriaLabel", () => {
  it("includes neighbourhood, bid, and time phrase", () => {
    const label = formatMapPillAriaLabel(
      "Floreasca",
      12_500_000,
      "live",
      starts,
      ends,
      liveNow,
      "ro",
    );
    expect(label).toContain("Floreasca");
    expect(label).toMatch(/ofertă curentă/);
    expect(label).toMatch(/se încheie în/);
  });
});

describe("formatMapClusterAriaLabel", () => {
  it("is bilingual by language", () => {
    expect(formatMapClusterAriaLabel(12, "ro")).toContain("Grup de 12");
    expect(formatMapClusterAriaLabel(12, "en")).toContain("Cluster of 12");
  });
});
