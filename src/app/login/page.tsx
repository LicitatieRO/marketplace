import { redirect } from "next/navigation";

export default async function LoginRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const intent = typeof params.intent === "string" ? params.intent : undefined;
  const qs = new URLSearchParams({ mode: "login" });
  if (next) qs.set("next", next);
  if (intent) qs.set("intent", intent);
  redirect(`/account?${qs.toString()}`);
}