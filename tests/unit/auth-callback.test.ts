import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const exchangeCodeForSession = vi.fn();
const verifyOtp = vi.fn();
const getSupabase = vi.fn(async () => ({
  auth: { exchangeCodeForSession, verifyOtp },
}));

vi.mock("@/lib/server/supabase", () => ({
  getSupabase: () => getSupabase(),
}));

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  vi.resetModules();
  exchangeCodeForSession.mockReset();
  verifyOtp.mockReset();
  getSupabase.mockReset();
});

describe("GET /auth/callback", () => {
  it("exchanges ?code= and redirects to a safe next path", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/callback?code=pkce-code&next=%2Fworkspace",
      ),
    );
    expect(response.status).toBe(307);
    expect(exchangeCodeForSession).toHaveBeenCalledWith("pkce-code");
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost:3000/workspace");
  });

  it("verifies token_hash for type=recovery without using PKCE exchange", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/callback?token_hash=hashed-recovery&type=recovery&next=%2Faccount%3Fmode%3Dreset",
      ),
    );
    expect(response.status).toBe(307);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "recovery",
      token_hash: "hashed-recovery",
    });
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/account?mode=reset",
    );
  });

  it("rejects an invalid token_hash with a generic verification error", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "invalid" } });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/callback?token_hash=bad&type=recovery",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/account?error=verification",
    );
  });

  it("rejects token_hash when type is missing or not recovery", async () => {
    const { GET } = await import("@/app/auth/callback/route");
    for (const query of [
      "token_hash=hashed",
      "token_hash=hashed&type=email",
      "token_hash=hashed&type=signup",
    ]) {
      verifyOtp.mockClear();
      const response = await GET(
        new Request(`http://localhost:3000/auth/callback?${query}`),
      );
      expect(verifyOtp).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/account?error=verification",
      );
    }
  });

  it("blocks open redirects on the recovery success path", async () => {
    verifyOtp.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(
      new Request(
        "http://localhost:3000/auth/callback?token_hash=ok&type=recovery&next=%2F%2Fevil.test",
      ),
    );
    expect(response.headers.get("location")).toBe("http://localhost:3000/workspace");
  });

  it("redirects to verification error when the same recovery token_hash is reused", async () => {
    verifyOtp
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "expired" } });
    const { GET } = await import("@/app/auth/callback/route");
    const requestUrl =
      "http://localhost:3000/auth/callback?token_hash=reuse-me&type=recovery&next=%2Faccount%3Fmode%3Dreset";
    const first = await GET(new Request(requestUrl));
    expect(first.headers.get("location")).toBe(
      "http://localhost:3000/account?mode=reset",
    );
    const second = await GET(new Request(requestUrl));
    expect(second.headers.get("location")).toBe(
      "http://localhost:3000/account?error=verification",
    );
  });
});
