import { headers } from "next/headers";
import { getCatalogue } from "@/lib/server/catalogue";
import { getExternalAuctionListings } from "@/lib/server/external-auctions";
import { isRepesExternalAuctionsEnabled } from "@/lib/server/repes-external-flag";
import { Catalogue } from "@/components/catalogue";

export const dynamic = "force-dynamic";

export default async function Home() {
  const listings = await getCatalogue();
  const host = (await headers()).get("host");
  const externalEnabled = isRepesExternalAuctionsEnabled(host);
  const externalAuctions = externalEnabled
    ? await getExternalAuctionListings()
    : [];
  return (
    <Catalogue
      listings={listings}
      externalAuctions={externalEnabled ? externalAuctions : undefined}
    />
  );
}
