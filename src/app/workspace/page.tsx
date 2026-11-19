import { WorkspaceView } from "@/components/workspace";
export const dynamic = "force-dynamic";
export const metadata = { title: "Spațiul tău" };
export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <WorkspaceView initialTab={tab === "owner" ? "owner" : "buyer"} />;
}
