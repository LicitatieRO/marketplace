import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import path from "node:path";
import { RECOVERY_PREVIEW_SUBJECT } from "@/lib/server/recovery-email";

describe("recovery preview subject", () => {
  it("matches the fixed subject literal in migration 034", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/202611150034_staging_recovery_notification_preview.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain(RECOVERY_PREVIEW_SUBJECT);
  });
});
