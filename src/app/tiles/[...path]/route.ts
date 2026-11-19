import type { NextRequest } from "next/server";
import { servePmtilesTile } from "@/lib/pmtiles-tile-serve";

export const runtime = "nodejs";

async function handleTilesRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
  method: "GET" | "HEAD",
) {
  const pathSegments = (await context.params).path;
  return servePmtilesTile({
    method,
    pathSegments,
    rangeHeader: request.headers.get("range"),
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleTilesRequest(request, context, "GET");
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  return handleTilesRequest(request, context, "HEAD");
}