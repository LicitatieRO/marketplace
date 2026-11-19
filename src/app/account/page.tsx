import { Account } from "@/components/account";
export const dynamic = "force-dynamic";
export const metadata = { title: "Contul tău" };
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  const initialMode =
    mode === "signup"
      ? "signup"
      : mode === "reset"
        ? "reset"
        : mode === "recover"
          ? "recover"
          : "login";
  return <Account initialMode={initialMode} />;
}
