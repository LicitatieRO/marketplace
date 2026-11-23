import { ListingsMapPage } from "@/components/map/listings-map-page";
import {
  listingsMapUrlParamsFromRecord,
  parseListingsMapView,
} from "@/lib/listings-map-url";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const record = await searchParams;
  const initialMobileView = parseListingsMapView(
    listingsMapUrlParamsFromRecord(record),
  );
  return <ListingsMapPage initialMobileView={initialMobileView} />;
}