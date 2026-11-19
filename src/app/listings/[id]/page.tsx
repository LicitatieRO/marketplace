import { notFound } from "next/navigation";
import { getListing } from "@/lib/server/catalogue";
import { ListingDetail } from "@/components/listing-detail";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);
  return { title: listing?.title || "Locuință indisponibilă" };
}
export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();
  return <ListingDetail listing={listing} />;
}
