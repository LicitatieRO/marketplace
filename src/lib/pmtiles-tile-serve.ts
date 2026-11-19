import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import {
  type AllowedPmtilesBasename,
  bufferHasPmtilesMagic,
  parsePmtilesByteRange,
  pmtilesArchivePath,
  pmtilesResponseHeaders,
  pmtilesUnavailableResponseHeaders,
  resolvePmtilesTileBasename,
} from "@/lib/pmtiles-http";

export type PmtilesTileServeMethod = "GET" | "HEAD";

export type PmtilesTileServeInput = {
  method: PmtilesTileServeMethod;
  pathSegments: string[];
  rangeHeader: string | null;
};

export type PmtilesTileServeOptions = {
  tilesRoot?: string;
};

type ArchiveValidity = "valid" | "invalid";

const archiveValidityByBasename = new Map<string, ArchiveValidity>();

const PMTILES_MAGIC_READ_BYTES = 16;

export function clearPmtilesArchiveValidityCacheForTests(): void {
  archiveValidityByBasename.clear();
}

async function readArchiveMagic(
  filePath: string,
): Promise<Uint8Array | null> {
  let handle;
  try {
    handle = await open(filePath, "r");
    const buffer = Buffer.alloc(PMTILES_MAGIC_READ_BYTES);
    const { bytesRead } = await handle.read(
      buffer,
      0,
      PMTILES_MAGIC_READ_BYTES,
      0,
    );
    return buffer.subarray(0, bytesRead);
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

async function validatePmtilesArchiveOnDisk(
  basename: AllowedPmtilesBasename,
  filePath: string,
): Promise<ArchiveValidity> {
  const cached = archiveValidityByBasename.get(basename);
  if (cached) return cached;

  const prefix = await readArchiveMagic(filePath);
  const valid = prefix !== null && bufferHasPmtilesMagic(prefix);
  const result: ArchiveValidity = valid ? "valid" : "invalid";
  archiveValidityByBasename.set(basename, result);

  if (!valid) {
    console.warn(
      `PMTiles tile archive unavailable (run git lfs pull or refresh the extract): tile=${basename}`,
    );
  }

  return result;
}

function nodeBodyFromReadStream(
  filePath: string,
  start: number,
  end: number,
): ReadableStream<Uint8Array> {
  const stream = createReadStream(filePath, { start, end });
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export async function servePmtilesTile(
  input: PmtilesTileServeInput,
  options: PmtilesTileServeOptions = {},
): Promise<Response> {
  const tilesRoot =
    options.tilesRoot ?? path.join(process.cwd(), "data", "tiles");

  const basename = resolvePmtilesTileBasename(input.pathSegments);
  if (!basename) {
    return new Response("Not Found", { status: 404 });
  }

  const filePath = pmtilesArchivePath(basename, tilesRoot);
  let fileSize: number;
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return new Response("Not Found", { status: 404 });
    }
    fileSize = fileStat.size;
  } catch {
    return new Response("Not Found", { status: 404 });
  }

  const validity = await validatePmtilesArchiveOnDisk(basename, filePath);
  if (validity === "invalid") {
    return new Response("PMTiles archive unavailable", {
      status: 503,
      headers: pmtilesUnavailableResponseHeaders(),
    });
  }

  const range = parsePmtilesByteRange(input.rangeHeader, fileSize);
  if (range.kind === "unsatisfiable") {
    return new Response(null, {
      status: 416,
      headers: pmtilesResponseHeaders(fileSize, range, { cacheable: false }),
    });
  }

  const headers = pmtilesResponseHeaders(fileSize, range);
  const sendBody = input.method !== "HEAD";

  if (fileSize === 0) {
    return new Response(sendBody ? new Uint8Array(0) : null, {
      status: 200,
      headers,
    });
  }

  if (range.kind === "full") {
    return new Response(
      sendBody ? nodeBodyFromReadStream(filePath, 0, fileSize - 1) : null,
      { status: 200, headers },
    );
  }

  return new Response(
    sendBody
      ? nodeBodyFromReadStream(filePath, range.start, range.end)
      : null,
    {
      status: 206,
      headers,
    },
  );
}
