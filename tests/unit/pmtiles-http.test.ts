import { describe, expect, it } from "vitest";
import {
  PMTILES_ACCEPT_RANGES,
  PMTILES_CACHE_CONTROL,
  PMTILES_UNAVAILABLE_CACHE_CONTROL,
  ALLOWED_PMTILES_BASENAMES,
  bufferHasPmtilesMagic,
  parsePmtilesByteRange,
  pmtilesResponseHeaders,
  PMTILES_MAGIC_BYTES,
  PMTILES_V3_HEADER_PREFIX,
  resolvePmtilesTileBasename,
} from "@/lib/pmtiles-http";

describe("PMTiles HTTP headers config", () => {
  it("exposes byte ranges and long-lived cache for the fixed extract name", () => {
    expect(PMTILES_ACCEPT_RANGES).toBe("bytes");
    expect(PMTILES_CACHE_CONTROL).toContain("immutable");
    expect(PMTILES_CACHE_CONTROL).toContain("max-age=");
    expect(ALLOWED_PMTILES_BASENAMES).toContain("bucharest-ilfov.pmtiles");
    expect(PMTILES_UNAVAILABLE_CACHE_CONTROL).toBe("no-store");
  });

  it("builds 206 Content-Range for a partial range", () => {
    const range = parsePmtilesByteRange("bytes=0-1023", 50_000);
    expect(range).toEqual({ kind: "partial", start: 0, end: 1023 });
    const headers = pmtilesResponseHeaders(50_000, range);
    expect(headers.get("Accept-Ranges")).toBe("bytes");
    expect(headers.get("Cache-Control")).toBe(PMTILES_CACHE_CONTROL);
    expect(headers.get("Content-Range")).toBe("bytes 0-1023/50000");
    expect(headers.get("Content-Length")).toBe("1024");
  });

  it("builds full-file headers without Content-Range", () => {
    const range = parsePmtilesByteRange(null, 123);
    expect(range).toEqual({ kind: "full" });
    const headers = pmtilesResponseHeaders(123, range);
    expect(headers.get("Content-Length")).toBe("123");
    expect(headers.get("Content-Range")).toBeNull();
  });

  it("returns 416 metadata for out-of-range requests", () => {
    const range = parsePmtilesByteRange("bytes=999999-", 1000);
    expect(range).toEqual({ kind: "unsatisfiable" });
    const headers = pmtilesResponseHeaders(1000, range, { cacheable: false });
    expect(headers.get("Content-Range")).toBe("bytes */1000");
    expect(headers.get("Cache-Control")).toBe(PMTILES_UNAVAILABLE_CACHE_CONTROL);
  });

  it("supports suffix byte ranges", () => {
    const range = parsePmtilesByteRange("bytes=-10", 100);
    expect(range).toEqual({ kind: "partial", start: 90, end: 99 });
  });

  it("rejects bare bytes=-", () => {
    expect(parsePmtilesByteRange("bytes=-", 100)).toEqual({
      kind: "unsatisfiable",
    });
  });

  it("rejects multi-range requests", () => {
    expect(parsePmtilesByteRange("bytes=0-1,5-6", 100)).toEqual({
      kind: "unsatisfiable",
    });
  });

  it("zero-size file: full without Range, unsatisfiable with Range", () => {
    expect(parsePmtilesByteRange(null, 0)).toEqual({ kind: "full" });
    expect(parsePmtilesByteRange("bytes=0-0", 0)).toEqual({
      kind: "unsatisfiable",
    });
  });
});

describe("PMTiles magic and path resolution", () => {
  it("detects PMTiles v3 magic bytes", () => {
    expect(bufferHasPmtilesMagic(Buffer.from(PMTILES_V3_HEADER_PREFIX))).toBe(
      true,
    );
    expect(bufferHasPmtilesMagic(Buffer.from(PMTILES_MAGIC_BYTES))).toBe(false);
    expect(
      bufferHasPmtilesMagic(
        Buffer.from("version https://git-lfs.github.com/spec/v1\n"),
      ),
    ).toBe(false);
  });

  it("rejects traversal in path segments", () => {
    expect(resolvePmtilesTileBasename(["..", "bucharest-ilfov.pmtiles"])).toBe(
      null,
    );
    expect(resolvePmtilesTileBasename(["%2e%2e"])).toBeNull();
    expect(resolvePmtilesTileBasename(["bucharest-ilfov.pmtiles"])).toBe(
      "bucharest-ilfov.pmtiles",
    );
    expect(resolvePmtilesTileBasename(["other.pmtiles"])).toBeNull();
  });
});
