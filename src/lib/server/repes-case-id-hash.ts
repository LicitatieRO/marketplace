import "server-only";
import { createHash } from "node:crypto";

function repesCaseIdHashSalt(): string | null {
  const value = process.env.REPES_CASE_ID_HASH_SALT?.trim();
  return value || null;
}

export function hashRepesCaseId(caseId: string): string {
  const salt = repesCaseIdHashSalt();
  if (!salt) {
    if (process.env.REPES_USE_FIXTURE === "true" || process.env.NODE_ENV === "test") {
      return createHash("sha256")
        .update(`fixture-salt:${caseId}`)
        .digest("hex");
    }
    throw new Error("REPES_CASE_ID_HASH_SALT is required for ingest");
  }
  return createHash("sha256").update(`${salt}:${caseId}`).digest("hex");
}
