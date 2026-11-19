import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getUserIdentities = vi.fn();
const unlinkIdentity = vi.fn();

const getSupabase = vi.fn(async () => ({
  auth: { getUserIdentities, unlinkIdentity, getUser: vi.fn() },
}));

vi.mock("@/lib/server/supabase", () => ({
  getSupabase: () => getSupabase(),
}));

vi.mock("@/lib/server/auth-rate-limit", () => ({
  enforceAuthHttpRateLimit: vi.fn(async () => null),
}));

vi.mock("@/lib/server/auth", () => ({
  requireSignedInUser: vi.fn(async () => ({
    db: await getSupabase(),
    user: { id: "user-1" },
  })),
}));

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  vi.clearAllMocks();
});

describe("POST /api/account/identities unlink guard", () => {
  it("rejects when only one identity is linked", async () => {
    getUserIdentities.mockResolvedValue({
      data: {
        identities: [
          { id: "only", provider: "facebook", identity_id: "fb-1" },
        ],
      },
      error: null,
    });
    const { POST } = await import("@/app/api/account/identities/route");
    const response = await POST(
      new Request("http://localhost:3000/api/account/identities", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "unlink", identityId: "only" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(unlinkIdentity).not.toHaveBeenCalled();
  });

  it("unlinks when another identity remains", async () => {
    getUserIdentities.mockResolvedValue({
      data: {
        identities: [
          { id: "oauth", provider: "google", identity_id: "g-1" },
          { id: "email", provider: "email", identity_id: "e-1" },
        ],
      },
      error: null,
    });
    unlinkIdentity.mockResolvedValue({ error: null });
    const { POST } = await import("@/app/api/account/identities/route");
    const response = await POST(
      new Request("http://localhost:3000/api/account/identities", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "unlink", identityId: "oauth" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(unlinkIdentity).toHaveBeenCalled();
  });
});
