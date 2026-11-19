import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (fn: () => void | Promise<void>) => {
      void fn();
    },
  };
});

const generateLink = vi.fn();
const signUp = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/server/auth-rate-limit", () => ({
  enforceAuthHttpRateLimit: vi.fn(async () => null),
}));

vi.mock("@/lib/server/supabase", () => ({
  getSupabase: vi.fn(async () => ({
    auth: { signUp, signOut: vi.fn(), signInWithPassword: vi.fn(), getUser: vi.fn(), resetPasswordForEmail: vi.fn(), updateUser: vi.fn() },
  })),
}));

vi.mock("@/lib/server/notifications-db", () => ({
  notificationServiceClient: vi.fn(() => ({
    auth: { admin: { generateLink } },
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
  generateLink.mockReset();
  signUp.mockReset();
  rpc.mockReset();
  process.env = {
    ...env,
    APP_URL: "http://localhost:3000",
    STAGING_SIGNUP_LINK_ENABLED: "true",
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

describe("staging signup auth route", () => {
  const baseBody = {
    action: "signup" as const,
    email: "new-user@example.test",
    password: "long-enough-pass",
    displayName: "Member",
  };

  it("uses normal signUp when the gate is off", async () => {
    delete process.env.STAGING_SIGNUP_LINK_ENABLED;
    signUp.mockResolvedValue({ error: null });
    const response = await POST(jsonRequest(baseBody));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(signUp).toHaveBeenCalledOnce();
    expect(generateLink).not.toHaveBeenCalled();
    expect(payload.data?.message).toContain("Check your email");
    expect(JSON.stringify(payload)).not.toMatch(/action_link|token/i);
  });

  it("returns uniform success when signUp fails and the gate is off", async () => {
    delete process.env.STAGING_SIGNUP_LINK_ENABLED;
    signUp.mockResolvedValue({
      error: { message: "User already registered", code: "email_exists" },
    });
    const response = await POST(jsonRequest(baseBody));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data?.message).toContain("Check your email");
    expect(JSON.stringify(payload)).not.toMatch(/already|registered/i);
  });

  it("calls generateLink and stores an outbox preview when the gate is on", async () => {
    const redirectTo =
      "http://localhost:3000/auth/callback?next=%2Flistings%2F20000000-0000-4000-8000-000000000001";
    const actionLink = `http://127.0.0.1:54321/auth/v1/verify?token=secret-token&redirect_to=${encodeURIComponent(redirectTo)}`;
    generateLink.mockResolvedValue({
      data: {
        user: { id: "aaaaaaaa-0000-4000-8000-000000000001" },
        properties: { action_link: actionLink },
      },
      error: null,
    });
    rpc.mockResolvedValue({ data: true, error: null });
    signUp.mockResolvedValue({ error: null });

    const response = await POST(
      jsonRequest({
        ...baseBody,
        next: "/listings/20000000-0000-4000-8000-000000000001",
      }),
    );
    const payload = await response.json();
    const bodyText = JSON.stringify(payload);

    expect(response.status).toBe(200);
    expect(signUp).not.toHaveBeenCalled();
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "signup",
        email: baseBody.email,
        password: baseBody.password,
        options: expect.objectContaining({
          redirectTo: expect.stringMatching(
            /^http:\/\/localhost:3000\/auth\/callback\?next=/,
          ),
        }),
      }),
    );
    expect(generateLink.mock.calls[0]?.[0]?.options).not.toHaveProperty(
      "email_confirm",
    );
    expect(rpc).toHaveBeenCalledWith(
      "store_staging_signup_notification_preview",
      expect.objectContaining({
        p_user_id: "aaaaaaaa-0000-4000-8000-000000000001",
        p_recipient_email: baseBody.email,
      }),
    );
    expect(bodyText).not.toContain("secret-token");
    expect(bodyText).not.toContain("action_link");
    expect(bodyText).not.toContain(baseBody.password);
  });

  it("builds redirectTo from APP_URL and ignores hostile Host/next", async () => {
    process.env.APP_URL = "https://licitatiero-staging.vercel.app";
    process.env.VERCEL_ENV = "development";
    const stagingRedirect =
      "https://licitatiero-staging.vercel.app/auth/callback?next=%2Fworkspace";
    const stagingActionLink = `http://127.0.0.1:54321/auth/v1/verify?token=abc&redirect_to=${encodeURIComponent(stagingRedirect)}`;
    generateLink.mockResolvedValue({
      data: {
        user: { id: "aaaaaaaa-0000-4000-8000-000000000001" },
        properties: { action_link: stagingActionLink },
      },
      error: null,
    });
    rpc.mockResolvedValue({ data: true, error: null });

    const stagingOrigin = "https://licitatiero-staging.vercel.app";
    await POST(
      new Request(`${stagingOrigin}/api/auth`, {
        method: "POST",
        headers: {
          Origin: stagingOrigin,
          Host: "evil.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...baseBody,
          next: "https://evil.example/phish",
        }),
      }),
    );

    const redirectTo = generateLink.mock.calls[0]?.[0]?.options?.redirectTo as string;
    expect(redirectTo.startsWith("https://licitatiero-staging.vercel.app/auth/callback")).toBe(true);
    expect(redirectTo).not.toContain("evil.example");
    expect(redirectTo).toContain(encodeURIComponent("/workspace"));
  });
});