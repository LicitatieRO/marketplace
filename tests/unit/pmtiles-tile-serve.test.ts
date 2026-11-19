import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PMTILES_UNAVAILABLE_CACHE_CONTROL,
  PMTILES_V3_HEADER_PREFIX,
} from "@/lib/pmtiles-http";
import {
  clearPmtilesArchiveValidityCacheForTests,
  servePmtilesTile,
} from "@/lib/pmtiles-tile-serve";

const LFS_POINTER =
  "version https://git-lfs.github.com/spec/v1\noid sha256:deadbeef\nsize 35224795\n";

describe("servePmtilesTile", () => {
  let tilesRoot: string;

  beforeEach(async () => {
    clearPmtilesArchiveValidityCacheForTests();
    tilesRoot = await mkdtemp(path.join(tmpdir(), "pmtiles-serve-"));
  });

  afterEach(() => {
    clearPmtilesArchiveValidityCacheForTests();
  });

  async function writeTile(
    name: string,
    body: string | Uint8Array,
  ): Promise<void> {
    await writeFile(path.join(tilesRoot, name), body);
  }

  it("returns 503 no-store when the on-disk file is an LFS pointer", async () => {
    await writeTile("bucharest-ilfov.pmtiles", LFS_POINTER);
    const response = await servePmtilesTile(
      {
        method: "GET",
        pathSegments: ["bucharest-ilfov.pmtiles"],
        rangeHeader: null,
      },
      { tilesRoot },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe(
      PMTILES_UNAVAILABLE_CACHE_CONTROL,
    );
    expect(await response.text()).toContain("unavailable");
  });

  it("returns 404 for unknown allowlisted basename mismatch", async () => {
    const response = await servePmtilesTile(
      {
        method: "GET",
        pathSegments: ["other.pmtiles"],
        rangeHeader: null,
      },
      { tilesRoot },
    );
    expect(response.status).toBe(404);
  });

  it("returns 404 for traversal-like segments", async () => {
    const response = await servePmtilesTile(
      {
        method: "GET",
        pathSegments: ["%2e%2e"],
        rangeHeader: null,
      },
      { tilesRoot },
    );
    expect(response.status).toBe(404);
  });

  it("HEAD returns headers without a body", async () => {
    const payload = Buffer.concat([
      Buffer.from(PMTILES_V3_HEADER_PREFIX),
      Buffer.alloc(92),
    ]);
    await writeTile("bucharest-ilfov.pmtiles", payload);
    const response = await servePmtilesTile(
      {
        method: "HEAD",
        pathSegments: ["bucharest-ilfov.pmtiles"],
        rangeHeader: null,
      },
      { tilesRoot },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.body).toBeNull();
  });

  it("returns 206 for a valid Range on a magic-prefixed archive", async () => {
    const payload = Buffer.concat([
      Buffer.from(PMTILES_V3_HEADER_PREFIX),
      Buffer.alloc(254, 0),
    ]);
    await writeTile("bucharest-ilfov.pmtiles", payload);
    const response = await servePmtilesTile(
      {
        method: "GET",
        pathSegments: ["bucharest-ilfov.pmtiles"],
        rangeHeader: "bytes=0-15",
      },
      { tilesRoot },
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Range")).toBe("bytes 0-15/262");
    const body = new Uint8Array(await response.arrayBuffer());
    expect(body).toHaveLength(16);
    expect([...body.subarray(0, 8)]).toEqual([...PMTILES_V3_HEADER_PREFIX]);
  });

  it("returns 416 for multi-range", async () => {
    const payload = Buffer.concat([
      Buffer.from(PMTILES_V3_HEADER_PREFIX),
      Buffer.alloc(10),
    ]);
    await writeTile("bucharest-ilfov.pmtiles", payload);
    const response = await servePmtilesTile(
      {
        method: "GET",
        pathSegments: ["bucharest-ilfov.pmtiles"],
        rangeHeader: "bytes=0-1,5-6",
      },
      { tilesRoot },
    );
    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe("bytes */18");
    expect(response.headers.get("Cache-Control")).toBe(
      PMTILES_UNAVAILABLE_CACHE_CONTROL,
    );
  });

  it("returns 503 for zero-byte file (no magic)", async () => {
    await writeTile("bucharest-ilfov.pmtiles", "");
    const response = await servePmtilesTile(
      {
        method: "GET",
        pathSegments: ["bucharest-ilfov.pmtiles"],
        rangeHeader: null,
      },
      { tilesRoot },
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe(
      PMTILES_UNAVAILABLE_CACHE_CONTROL,
    );
  });
});
