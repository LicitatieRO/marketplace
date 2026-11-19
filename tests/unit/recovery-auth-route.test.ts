import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const scheduledAfter: Array<() => void | Promise<void>> = [];

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => void | Promise<void>) => {
      scheduledAfter.push(fn);
    },
  };
});

const generateLink = vi.fn();
const resetPasswordForEmail = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/server/auth-rate-limit", () => ({
  enforceAuthHttpRateLimit: vi.fn(async () => null),
}));

vi.mock("@/lib/server/supabase", () => ({
  getSupabase: vi.fn(async () => ({
    auth: {
      signUp: vi.fn(),
      signOut: vi.fn(),
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
      resetPasswordForEmail,
      updateUser: vi.fn(),
    },
  })),
}));

vi.mock("@/lib/server/notifications-db", () => ({
  notificationServiceClient: vi.fn(() => ({
    auth: { admin: { generateLink, listUsers: vi.fn() } },
    rpc,
  })),
}));

vi.mock("@/lib/config", () => ({
  isConfigured: () => true,
  supabaseConfig: () => ({
    url: "http://127.0.0.1:54321",
    key: "test-anon",
  }),
}));

import { POST } from "@/app/api/auth/route";
import { RECOVERY_GENERIC_MESSAGE } from "@/lib/server/recovery-response";

const env = process.env;

function jsonRequest(body: Record<string, unknown>, host = "localhost:3000") {
  return new Request("http://localhost:3000/api/auth", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3000",
      Host: host,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  scheduledAfter.length = 0;
  generateLink.mockReset();
  resetPasswordForEmail.mockReset();
  rpc.mockReset();
  rpc.mockImplementation((name: string) => {
    if (name === "recovery_generate_link_cooldown_active") {
      return Promise.resolve({ data: false, error: null });
    }
    return Promise.resolve({ data: true, error: null });
  });
  process.env = {
    ...env,
    APP_URL: "http://localhost:3000",
    APP_SENT_RECOVERY_ENABLED: "true",
    EMAIL_DELIVERY_MODE: "staging_outbox",
    VERCEL_ENV: "development",
    SUPABASE_SECRET_KEY: "test-service-key",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-anon",
  };
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  process.env = { ...env };
  vi.unstubAllEnvs();
});

describe("POST recover", () => {
  it("returns the same generic message when generateLink fails for an unknown email", async () => {
    generateLink.mockResolvedValue({
      data: { user: null, properties: {} },
      error: { message: "User not found", code: "user_not_found" },
    });
    const response = await POST(
      jsonRequest({ action: "recover", email: "unknown@example.test" }),
    );
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({ data: { message: RECOVERY_GENERIC_MESSAGE } });
    await scheduledAfter[0]?.();
    expect(generateLink).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith(
      "store_staging_recovery_notification_preview",
      expect.anything(),
    );
  });

  it("returns before deferred app-sent recovery work finishes", async () => {
    generateLink.mockImplementation(() => new Promise(() => {}));
    const response = await Promise.race([
      POST(jsonRequest({ action: "recover", email: "buyer@licitatiero.local" })),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("recover response blocked on send")), 250),
      ),
    ]);
    expect(response.status).toBe(200);
    expect(scheduledAfter).toHaveLength(1);
    const work = scheduledAfter[0]?.();
    expect(work).toBeInstanceOf(Promise);
    await expect(
      Promise.race([
        work,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("send_still_pending")), 50),
        ),
      ]),
    ).rejects.toThrow("send_still_pending");
  });

  it("stores an outbox preview after the response when send completes", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    generateLink.mockResolvedValue({
      data: {
        user: { id: "aaaaaaaa-0000-4000-8000-000000000001" },
        properties: { hashed_token: "recovery-hashed-token" },
      },
      error: null,
    });
    const response = await POST(
      jsonRequest({ action: "recover", email: "buyer@licitatiero.local" }),
    );
    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalledWith(
      "store_staging_recovery_notification_preview",
      expect.anything(),
    );
    await scheduledAfter[0]?.();
    expect(rpc).toHaveBeenCalledWith(
      "store_staging_recovery_notification_preview",
      expect.objectContaining({
        p_user_id: "aaaaaaaa-0000-4000-8000-000000000001",
        p_recipient_email: "buyer@licitatiero.local",
      }),
    );
    const previewBody = rpc.mock.calls.find(
      (call) => call[0] === "store_staging_recovery_notification_preview",
    )?.[1]?.p_body as string;
    expect(previewBody).toContain("token_hash=recovery-hashed-token");
    expect(previewBody).not.toContain("auth/v1/verify");
    const logText = errorSpy.mock.calls.map((call) => JSON.stringify(call)).join(" ");
    expect(logText).not.toContain("recovery-hashed-token");
    expect(logText).not.toContain("token_hash=");
  });

  it("skips generateLink when cooldown RPC reports active", async () => {
    rpc.mockImplementation((name: string) => {
      if (name === "recovery_generate_link_cooldown_active") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: true, error: null });
    });
    const response = await POST(
      jsonRequest({ action: "recover", email: "buyer@licitatiero.local" }),
    );
    expect(response.status).toBe(200);
    await scheduledAfter[0]?.();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("falls back to resetPasswordForEmail when the app-sent gate is off", async () => {
    delete process.env.APP_SENT_RECOVERY_ENABLED;
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const response = await POST(
      jsonRequest({ action: "recover", email: "buyer@licitatiero.local" }, "localhost:3000"),
    );
    expect(response.status).toBe(200);
    await scheduledAfter[0]?.();
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "buyer@licitatiero.local",
      expect.objectContaining({
        redirectTo: expect.stringContaining("http://localhost:3000/auth/callback"),
      }),
    );
    expect(generateLink).not.toHaveBeenCalled();
    const redirectTo = resetPasswordForEmail.mock.calls[0]?.[1]?.redirectTo as string;
    expect(redirectTo).not.toContain("evil.example");
  });

  it("uses the request origin for legacy recovery when configured site origin env is unset", async () => {
    delete process.env.APP_SENT_RECOVERY_ENABLED;
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const response = await POST(
      jsonRequest({ action: "recover", email: "buyer@licitatiero.local" }, "localhost:3000"),
    );
    expect(response.status).toBe(200);
    await scheduledAfter[0]?.();
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "buyer@licitatiero.local",
      expect.objectContaining({
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Faccount%3Fmode%3Dreset",
      }),
    );
  });
});
