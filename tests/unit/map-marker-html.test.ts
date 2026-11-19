import { describe, expect, it } from "vitest";
import { formatMapPillAriaLabel } from "@/lib/map-listing-time";
import { mapPricePillButtonHtml } from "@/lib/map-price-pill-html";
import { buildMapClusterMarkerHtml } from "@/lib/map-marker-html";

const xss = '"><img src=x onerror=alert(1)>';
const starts = "2099-06-01T10:00:00.000Z";
const ends = "2099-06-03T10:00:00.000Z";
const liveNow = new Date("2099-06-02T09:00:00.000Z").getTime();

describe("mapPricePillButtonHtml", () => {
  it("does not reflect raw HTML or attribute breakout from listing fields", () => {
    const ariaLabel = formatMapPillAriaLabel(
      xss,
      12_500_000,
      "live",
      starts,
      ends,
      liveNow,
      "en",
    );
    const html = mapPricePillButtonHtml(xss, xss, ariaLabel, {
      selected: true,
      own: true,
      outbid: true,
    });

    expect(html).not.toMatch(/<img[\s/>]/i);
    expect(html).not.toMatch(/"\s+onerror=/i);
    expect(html).not.toContain('"><img');
    expect(html).toContain("&quot;&gt;");
    expect(html).toContain("&lt;img");
    expect(html).toContain("lr-price-pill");
    expect(html).not.toMatch(/data-listing-id="[^"]*"><img/);
  });
});

describe("buildMapClusterMarkerHtml", () => {
  it("escapes cluster count and aria label", () => {
    const html = buildMapClusterMarkerHtml(12, xss);
    expect(html).toContain("&lt;img");
    expect(html).not.toMatch(/<img[\s/>]/i);
  });
});