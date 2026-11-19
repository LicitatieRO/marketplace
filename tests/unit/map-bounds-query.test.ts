import { describe, expect, it } from "vitest";
import {
  mapBboxQueryEquals,
  mapBboxQueryKey,
  normalizeMapBbox,
} from "@/lib/map-bounds-query";

describe("map-bounds-query", () => {
  it("rounds bbox components for stable keys", () => {
    const a = normalizeMapBbox({
      west: 26.10391234,
      south: 44.43251234,
      east: 26.20391234,
      north: 44.53251234,
    });
    expect(a.west).toBe(26.1039);
    expect(mapBboxQueryKey(a, 11)).toBe("26.1039,44.4325,26.2039,44.5325@11");
  });

  it("treats tiny pan jitter within precision as equal", () => {
    const one = { west: 25.9, south: 44.3, east: 26.3, north: 44.5 };
    const jitter = { west: 25.90004, south: 44.30002, east: 26.29998, north: 44.49999 };
    expect(mapBboxQueryEquals(one, jitter, 11, 11)).toBe(true);
  });

  it("differs when zoom changes", () => {
    const bbox = { west: 25.9, south: 44.3, east: 26.3, north: 44.5 };
    expect(mapBboxQueryEquals(bbox, bbox, 11, 10)).toBe(false);
  });

  it("rejects non-finite bounds", () => {
    expect(() =>
      normalizeMapBbox({ west: Number.NaN, south: 44.3, east: 26.3, north: 44.5 }),
    ).toThrow(/Invalid map bounds/);
    expect(() =>
      normalizeMapBbox({
        west: 25.9,
        south: Number.POSITIVE_INFINITY,
        east: 26.3,
        north: 44.5,
      }),
    ).toThrow(/Invalid map bounds/);
  });
});