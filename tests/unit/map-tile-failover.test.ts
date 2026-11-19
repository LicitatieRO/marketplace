import { describe, expect, it } from "vitest";
import { viewportOutsideExtractBounds } from "@/lib/map-tile-bounds";
import {
  parseFailoverErrorLimit,
  parseFailoverWindowMs,
  parseMapTileProvider,
} from "@/lib/map-tile-client";
import { MapTileFailoverCounter } from "@/lib/map-tile-failover";
import { resolveMapSurface } from "@/lib/map-tiles";

describe("MAP_TILE_PROVIDER resolution", () => {
  it("defaults to osm", () => {
    expect(parseMapTileProvider(undefined)).toBe("osm");
    expect(parseMapTileProvider("")).toBe("osm");
    expect(parseMapTileProvider("OSM")).toBe("osm");
  });

  it("accepts pmtiles and off", () => {
    expect(parseMapTileProvider("pmtiles")).toBe("pmtiles");
    expect(parseMapTileProvider("off")).toBe("off");
  });

  it("maps surface for kill switch", () => {
    expect(resolveMapSurface(true, "off")).toBe("unavailable");
    expect(resolveMapSurface(false, "off")).toBe("unavailable");
    expect(resolveMapSurface(false, "osm")).toBe("placeholder");
    expect(resolveMapSurface(true, "pmtiles")).toBe("interactive");
  });
});

describe("failover counter", () => {
  it("failovers after N tile errors inside the window", () => {
    let now = 0;
    const counter = new MapTileFailoverCounter(5, 15_000, () => now);
    for (let i = 0; i < 4; i++) {
      now += 100;
      expect(counter.recordTileLoadError().shouldFailover).toBe(false);
    }
    now += 100;
    expect(counter.recordTileLoadError().shouldFailover).toBe(true);
  });

  it("drops errors outside the sliding window", () => {
    let now = 0;
    const counter = new MapTileFailoverCounter(5, 1000, () => now);
    for (let i = 0; i < 4; i++) {
      now += 100;
      counter.recordTileLoadError();
    }
    now += 2000;
    expect(counter.recordTileLoadError().shouldFailover).toBe(false);
  });

  it("parses failover env limits", () => {
    expect(parseFailoverErrorLimit(undefined)).toBe(5);
    expect(parseFailoverErrorLimit("2")).toBe(2);
    expect(parseFailoverErrorLimit("999")).toBe(50);
    expect(parseFailoverWindowMs(undefined)).toBe(15_000);
    expect(parseFailoverWindowMs("5000")).toBe(5000);
  });
});

describe("extract bounds guard", () => {
  it("flags viewports outside Bucharest+Ilfov", () => {
    expect(
      viewportOutsideExtractBounds({
        west: 25.6,
        south: 44.3,
        east: 26.2,
        north: 44.5,
      }),
    ).toBe(false);
    expect(
      viewportOutsideExtractBounds({
        west: 20,
        south: 44.3,
        east: 26.2,
        north: 44.5,
      }),
    ).toBe(true);
  });
});