import { assertSameOrigin, requestOrigin, RequestError } from "@/lib/security";
import { isPocSwitcherServerEnabled } from "@/lib/server/poc-switcher";
import { getSupabase } from "@/lib/server/supabase";
import { isConfigured } from "@/lib/config";
import { failure, json, readJson } from "@/lib/server/http";
import { z } from "zod";
export const dynamic = "force-dynamic";
const inputSchema = z
  .object({
    persona: z.enum(["owner", "buyer", "dual"]),
  })
  .strict();
const EMAIL_BY_PERSONA = {
  owner: "owner@licitatiero.local",
  buyer: "buyer@licitatiero.local",
  dual: "dual@licitatiero.local",
} as const;
function passwordFor(persona: keyof typeof EMAIL_BY_PERSONA): string | undefined {
  const envKey =
    persona === "owner"
      ? process.env.POC_OWNER_PASSWORD
      : persona === "buyer"
        ? process.env.POC_BUYER_PASSWORD
        : process.env.POC_DUAL_PASSWORD;
  return envKey;
}
export async function POST(request: Request) {
  try {
    const requestHost = request.headers.get("host");
    if (!isPocSwitcherServerEnabled(requestHost))
      throw new RequestError("Not found.", 404);
    const origin = requestOrigin(request.url);
    assertSameOrigin(request.headers, origin);
    if (!isConfigured())
      throw new RequestError(
        "Accounts require a configured Supabase backend.",
        503,
      );
    const { persona } = inputSchema.parse(await readJson(request));
    const email = EMAIL_BY_PERSONA[persona];
    const password = passwordFor(persona);
    if (!password)
      throw new RequestError(
        "Staging persona credentials are not configured.",
        503,
      );
    const db = await getSupabase();
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw new RequestError("Could not switch persona.", 401);
    return json({ data: { ok: true, persona } });
  } catch (e) {
    return failure(e);
  }
}