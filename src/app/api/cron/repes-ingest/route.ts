import { timingSafeEqual } from "node:crypto";
import { failure, json } from "@/lib/server/http";
import { RequestError } from "@/lib/security";
import { isRepesExternalAuctionsEnabled } from "@/lib/server/repes-external-flag";
import { runRepesIngest } from "@/lib/server/repes-ingest";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization") ?? "";
  if (!expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    const host = request.headers.get("host");
    if (!isRepesExternalAuctionsEnabled(host)) {
      throw new RequestError("REPES external auctions disabled.", 404);
    }
    if (!authorized(request)) {
      throw new RequestError("Unauthorized worker request.", 401);
    }
    if (!process.env.SUPABASE_SECRET_KEY?.trim()) {
      throw new RequestError("Configure worker credentials before ingest.", 503);
    }
    const useFixture =
      process.env.REPES_USE_FIXTURE === "true" ||
      process.env.NODE_ENV === "test";
    const summary = await runRepesIngest({ useFixture, maxPages: 1 });
    return json({ status: "ok", ...summary });
  } catch (error) {
    return failure(error);
  }
}
