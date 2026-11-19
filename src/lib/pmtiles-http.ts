import path from "node:path";

/** Self-hosted PMTiles under `/tiles/*` (see `src/app/tiles/[...path]/route.ts`). */

/** PMTiles v3 file prefix: ASCII `PMTiles` plus version byte `0x03`. */
export const PMTILES_V3_HEADER_PREFIX = new Uint8Array([
  0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73, 0x03,
]);

/** @deprecated Use {@link PMTILES_V3_HEADER_PREFIX} in new tests; kept for short fixtures. */
export const PMTILES_MAGIC_BYTES = PMTILES_V3_HEADER_PREFIX.subarray(0, 2);

export const PMTILES_UNAVAILABLE_CACHE_CONTROL = "no-store";

/** On-disk archive (Git LFS); not under `public/` so the app route owns Range/cache headers. */
export function pmtilesArchivePath(
  basename: AllowedPmtilesBasename,
  tilesRoot = path.join(process.cwd(), "data", "tiles"),
): string {
  return path.join(tilesRoot, basename);
}

export const PMTILES_ACCEPT_RANGES = "bytes";

/** Fixed extract filename; bump or rename the file to invalidate caches. */
export const PMTILES_CACHE_CONTROL = "public, max-age=31536000, immutable";

export const PMTILES_CONTENT_TYPE = "application/octet-stream";

export const ALLOWED_PMTILES_BASENAMES = [
  "bucharest-ilfov.pmtiles",
] as const;

export type AllowedPmtilesBasename =
  (typeof ALLOWED_PMTILES_BASENAMES)[number];

export function isAllowedPmtilesBasename(name: string): name is AllowedPmtilesBasename {
  return (ALLOWED_PMTILES_BASENAMES as readonly string[]).includes(name);
}

/**
 * Resolves allowlisted tile basename from route segments (blocks traversal / encodings).
 */
export function resolvePmtilesTileBasename(
  segments: string[],
): AllowedPmtilesBasename | null {
  if (segments.length !== 1) return null;
  const raw = segments[0]!;
  if (raw.includes("..") || /%2e/i.test(raw)) return null;
  if (raw.includes("/") || raw.includes("\\")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.includes("..") || decoded.includes("/") || decoded.includes("\\")) {
    return null;
  }
  if (!isAllowedPmtilesBasename(decoded)) return null;
  return decoded;
}

export type ByteRangeSpec =
  | { kind: "full" }
  | { kind: "partial"; start: number; end: number }
  | { kind: "unsatisfiable" };

/**
 * Parses `Range: bytes=…` (single range only; rejects multi-range and `bytes=-`).
 */
export function parsePmtilesByteRange(
  rangeHeader: string | null,
  fileSize: number,
): ByteRangeSpec {
  if (fileSize === 0) {
    if (!rangeHeader?.startsWith("bytes=")) return { kind: "full" };
    return { kind: "unsatisfiable" };
  }

  if (!rangeHeader?.startsWith("bytes=")) {
    return { kind: "full" };
  }

  const rangeValue = rangeHeader.slice(6);
  const tokens = rangeValue.split(",").map((t) => t.trim());
  if (tokens.length > 1 || tokens.some((t) => t.length === 0)) {
    return { kind: "unsatisfiable" };
  }

  const token = tokens[0]!;
  const match = /^(\d*)-(\d*)$/.exec(token);
  if (!match) return { kind: "unsatisfiable" };

  const [, startRaw, endRaw] = match;
  if (startRaw === "" && endRaw === "") {
    return { kind: "unsatisfiable" };
  }

  let start: number;
  let end: number;

  if (startRaw === "" && endRaw !== "") {
    const suffix = Number(endRaw);
    if (!Number.isInteger(suffix) || suffix <= 0) {
      return { kind: "unsatisfiable" };
    }
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else if (endRaw === "") {
    start = Number(startRaw);
    if (!Number.isInteger(start) || start < 0) {
      return { kind: "unsatisfiable" };
    }
    if (start >= fileSize) return { kind: "unsatisfiable" };
    end = fileSize - 1;
  } else {
    start = Number(startRaw);
    end = Number(endRaw);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end < start
    ) {
      return { kind: "unsatisfiable" };
    }
    if (start >= fileSize) return { kind: "unsatisfiable" };
    end = Math.min(end, fileSize - 1);
  }

  return { kind: "partial", start, end };
}

export function pmtilesResponseHeaders(
  fileSize: number,
  range: ByteRangeSpec,
  options?: { cacheable?: boolean },
): Headers {
  const cacheable = options?.cacheable !== false;
  const headers = new Headers({
    "Accept-Ranges": PMTILES_ACCEPT_RANGES,
    "Cache-Control": cacheable
      ? PMTILES_CACHE_CONTROL
      : PMTILES_UNAVAILABLE_CACHE_CONTROL,
    "Content-Type": PMTILES_CONTENT_TYPE,
  });

  if (range.kind === "partial") {
    const length = range.end - range.start + 1;
    headers.set("Content-Length", String(length));
    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.end}/${fileSize}`,
    );
  } else if (range.kind === "full") {
    headers.set("Content-Length", String(fileSize));
  } else {
    headers.set("Content-Range", `bytes */${fileSize}`);
  }

  return headers;
}

export function pmtilesUnavailableResponseHeaders(): Headers {
  return new Headers({
    "Cache-Control": PMTILES_UNAVAILABLE_CACHE_CONTROL,
    "Content-Type": "text/plain; charset=utf-8",
  });
}

export function bufferHasPmtilesMagic(buffer: Uint8Array | Buffer): boolean {
  if (buffer.length < PMTILES_V3_HEADER_PREFIX.length) return false;
  for (let i = 0; i < PMTILES_V3_HEADER_PREFIX.length; i += 1) {
    if (buffer[i] !== PMTILES_V3_HEADER_PREFIX[i]) return false;
  }
  return true;
}
