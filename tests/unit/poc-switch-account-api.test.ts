import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getSupabase = vi.fn();
const readJson = vi.fn();

vi.mock("@/lib/server/supabase", () => ({
  getSupabase: (...args: unknown[]) => getSupabase(...args),
}));

vi.mock("@/lib/server/http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/http")>();
  return {
    ...actual,
    readJson: (...args: unknown[]) => readJson(...args),
  };
});

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  vi.unstubAllEnvs();
  vi.resetModules();
  getSupabase.mockReset();
  readJson.mockReset();
});

describe("POST /api/poc/switch-account", () => {
  it("returns 404 when POC_SWITCHER_ENABLED is unset", async () => {
    delete process.env.POC_SWITCHER_ENABLED;
    vi.stubEnv("NODE_ENV", "development");
    const { POST } = await import("@/app/api/poc/switch-account/route");
    const response = await POST(
      new Request("http://localhost:3000/api/poc/switch-account", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ persona: "owner" }),
      }),
    );
    expect(response.status).toBe(404);
    expect(getSupabase).not.toHaveBeenCalled();
    expect(readJson).not.toHaveBeenCalled();
  });
});