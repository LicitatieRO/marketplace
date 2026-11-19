import { getCatalogue } from "@/lib/server/catalogue";
import { Catalogue } from "@/components/catalogue";
export const dynamic = "force-dynamic";
export default async function Home() {
  const listings = await getCatalogue();
  return <Catalogue listings={listings} />;
}
