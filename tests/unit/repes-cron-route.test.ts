import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const runRepesIngest = vi.fn(async () => ({
  fetched: 0,
  filtered: 0,
  upserted: 0,
  skipped: 0,
  purged: 0,
}));

vi.mock("@/lib/server/repes-ingest", () => ({
  runRepesIngest,
}));

const env = process.env;

afterEach(() => {
  process.env = { ...env };
  runRepesIngest.mockReset();
  vi.resetModules();
});

describe("POST /api/cron/repes-ingest", () => {
  it("returns 401 when authorization is missing or wrong", async () => {
    process.env.REPES_EXTERNAL_AUCTIONS_ENABLED = "true";
    process.env.CRON_SECRET = "cron-test-secret";
    process.env.SUPABASE_SECRET_KEY = "service-key";
    process.env.VERCEL_ENV = "preview";
    const { POST } = await import("@/app/api/cron/repes-ingest/route");

    const missing = await POST(
      new Request("http://localhost/api/cron/repes-ingest", { method: "POST" }),
    );
    expect(missing.status).toBe(401);

    const wrong = await POST(
      new Request("http://localhost/api/cron/repes-ingest", {
        method: "POST",
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(wrong.status).toBe(401);
  });

  it("no-ops when the feature flag is off", async () => {
    delete process.env.REPES_EXTERNAL_AUCTIONS_ENABLED;
    process.env.CRON_SECRET = "cron-test-secret";
    const { POST } = await import("@/app/api/cron/repes-ingest/route");
    const response = await POST(
      new Request("http://localhost/api/cron/repes-ingest", {
        method: "POST",
        headers: { authorization: "Bearer cron-test-secret" },
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("disabled");
    expect(runRepesIngest).not.toHaveBeenCalled();
  });

  it("treats whitespace-only CRON_SECRET as unset", async () => {
    const { cronRequestAuthorized } = await import(
      "@/app/api/cron/repes-ingest/route"
    );
    process.env.CRON_SECRET = "   ";
    expect(
      cronRequestAuthorized(
        new Request("http://localhost", {
          headers: { authorization: "Bearer x" },
        }),
      ),
    ).toBe(false);
  });
});
