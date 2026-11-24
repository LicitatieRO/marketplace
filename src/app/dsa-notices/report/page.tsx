import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DsaReportForm } from "@/components/dsa-report-form";
import { getListing } from "@/lib/server/catalogue";
import { listingUrlFromRequest } from "@/lib/dsa-notice-url";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  listing_id: z.uuid(),
  external_source_id: z.string().trim().min(1).max(200).optional(),
});

export async function generateMetadata() {
  return { title: "Raportează conținut ilegal | Report illegal content" };
}

export default async function DsaNoticeReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const parsed = querySchema.safeParse({
    listing_id:
      typeof raw.listing_id === "string"
        ? raw.listing_id
        : Array.isArray(raw.listing_id)
          ? raw.listing_id[0]
          : undefined,
    external_source_id:
      typeof raw.external_source_id === "string"
        ? raw.external_source_id
        : Array.isArray(raw.external_source_id)
          ? raw.external_source_id[0]
          : undefined,
  });
  if (!parsed.success) notFound();

  const { listing_id: listingId, external_source_id: externalSourceId } =
    parsed.data;
  const listing = await getListing(listingId);
  if (!listing) notFound();

  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host");
  const proto = (await headers()).get("x-forwarded-proto") ?? "http";
  const requestUrl = host
    ? `${proto}://${host}/dsa-notices/report?listing_id=${listingId}`
    : `http://localhost:3000/dsa-notices/report?listing_id=${listingId}`;
  const listingUrl = listingUrlFromRequest(listingId, requestUrl);

  const defaultExplanation = externalSourceId
    ? `External REPES notice (source_id: ${externalSourceId}). `
    : undefined;

  return (
    <main id="main" className="page-width" style={{ padding: "32px 0" }}>
      <Link href={`/listings/${listingId}`} className="text-button">
        ←{" "}
        {`Raportează conținut ilegal | Report illegal content`.split(" | ")[0]}
      </Link>
      <h1 style={{ margin: "20px 0" }}>
        Raportează conținut ilegal | Report illegal content
      </h1>
      <DsaReportForm
        listingId={listingId}
        listingUrl={listingUrl}
        defaultExplanation={defaultExplanation}
      />
    </main>
  );
}