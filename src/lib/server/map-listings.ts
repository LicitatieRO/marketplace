import "server-only";
import type { MapListing } from "@/lib/map-listing-types";
import { isConfigured } from "@/lib/config";
import { demoListings } from "@/lib/fixtures";
import { getSupabase } from "./supabase";

function demoMapPoint(item: (typeof demoListings)[number]): {
  lat: number;
  lng: number;
} | null {
  const lat = item.publicLat ?? item.lat;
  const lng = item.publicLng ?? item.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    lat: Number(lat.toFixed(3)),
    lng: Number(lng.toFixed(3)),
  };
}

function demoMapListings(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}): MapListing[] {
  return demoListings
    .filter((item) => {
      const point = demoMapPoint(item);
      if (!point) return false;
      return (
        point.lat >= bounds.south &&
        point.lat <= bounds.north &&
        point.lng >= bounds.west &&
        point.lng <= bounds.east
      );
    })
    .map((item) => {
      const point = demoMapPoint(item)!;
      return {
        id: item.id,
        auctionId: item.auction_id,
        slug: item.id,
        title: item.title,
        sector: item.judet ?? "București",
        neighbourhood: item.neighborhood,
        approxLat: point.lat,
        approxLng: point.lng,
        photoUrl: item.image_urls[0] ?? null,
        currentBidCents: item.current_bid_minor ?? item.price_minor,
        minIncrementCents: item.min_increment_minor ?? 100_000,
        startsAt: item.starts_at,
        endsAt: item.ends_at,
        status:
          item.ends_at && new Date(item.ends_at).getTime() < Date.now()
            ? "ended"
            : item.starts_at && new Date(item.starts_at).getTime() > Date.now()
              ? "scheduled"
              : "live",
        transactionType: item.transaction_type,
        rooms: item.rooms,
        propertyType: item.property_type,
      };
    });
}

export async function fetchMapListingsInBbox(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}): Promise<MapListing[]> {
  if (!isConfigured()) return demoMapListings(bounds);
  const db = await getSupabase();
  const { data, error } = await db.rpc("get_map_listings_in_bbox", {
    p_west: bounds.west,
    p_south: bounds.south,
    p_east: bounds.east,
    p_north: bounds.north,
    p_limit: 200,
  });
  if (error) throw error;
  return (data ?? []) as MapListing[];
}
