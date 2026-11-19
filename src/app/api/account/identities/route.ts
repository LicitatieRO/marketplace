import { z } from "zod";
import { assertSameOrigin, requestOrigin, RequestError } from "@/lib/security";
import { canUnlinkIdentity, type LinkedIdentity } from "@/lib/auth-oauth";
import { enforceAuthHttpRateLimit } from "@/lib/server/auth-rate-limit";
import { requireSignedInUser } from "@/lib/server/auth";
import { failure, json, readJson } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const unlinkSchema = z
  .object({
    action: z.literal("unlink"),
    identityId: z.string().min(1).max(128),
  })
  .strict();

function mapIdentities(
  identities: Array<{
    id: string;
    provider: string;
    identity_id: string;
    identity_data?: { email?: string };
  }>,
): LinkedIdentity[] {
  return identities.map((row) => ({
    id: row.id,
    provider: row.provider,
    identity_id: row.identity_id,
    email:
      typeof row.identity_data?.email === "string"
        ? row.identity_data.email
        : undefined,
  }));
}

export async function GET() {
  try {
    const { db } = await requireSignedInUser();
    const { data, error } = await db.auth.getUserIdentities();
    if (error) throw new RequestError("Unable to read linked sign-in methods.", 503);
    const identities = mapIdentities(data?.identities || []);
    return json({
      data: {
        identities,
        canUnlink: canUnlinkIdentity(identities),
      },
    });
  } catch (e) {
    return failure(e);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request.headers, requestOrigin(request.url));
    const { db, user } = await requireSignedInUser();
    const input = unlinkSchema.parse(await readJson(request));
    const limited = await enforceAuthHttpRateLimit(
      request.headers,
      "accountUnlink",
      user.id,
    );
    if (limited) return limited;
    const { data: listed, error: listError } = await db.auth.getUserIdentities();
    if (listError) throw new RequestError("Unable to read linked sign-in methods.", 503);
    const identities = mapIdentities(listed?.identities || []);
    if (!canUnlinkIdentity(identities)) {
      throw new RequestError(
        "Keep at least one sign-in method on your account.",
        400,
      );
    }
    const raw = (listed?.identities || []).find(
      (item) => item.id === input.identityId,
    );
    if (!raw) {
      throw new RequestError("Sign-in method not found.", 404);
    }
    const { error } = await db.auth.unlinkIdentity(raw);
    if (error) {
      throw new RequestError("Could not unlink this sign-in method.", 503);
    }
    return json({ data: { unlinked: true } });
  } catch (e) {
    return failure(e);
  }
}
