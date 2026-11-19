import { NextRequest, NextResponse } from "next/server";
import { fetchMapListingsInBbox } from "@/lib/server/map-listings";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const west = Number(searchParams.get("west"));
  const south = Number(searchParams.get("south"));
  const east = Number(searchParams.get("east"));
  const north = Number(searchParams.get("north"));
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north) ||
    west >= east ||
    south >= north
  ) {
    return NextResponse.json({ error: "Invalid bbox" }, { status: 400 });
  }
  try {
    const listings = await fetchMapListingsInBbox({ west, south, east, north });
    return NextResponse.json({ data: listings, serverNowMs: Date.now() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Map listings failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}