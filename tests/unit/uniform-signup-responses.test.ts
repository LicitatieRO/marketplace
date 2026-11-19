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
const listUsers = vi.fn();
const signUp = vi.fn();
const resetPasswordForEmail = vi.fn();
const rpc = vi.fn();

vi.mock("@/lib/server/auth-rate-limit", () => ({
  enforceAuthHttpRateLimit: vi.fn(async () => null),
}));

vi.mock("@/lib/server/supabase", () => ({
  getSupabase: vi.fn(async () => ({
    auth: {
      signUp,
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
    auth: { admin: { generateLink, listUsers } },
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
import {
  SIGNUP_CHECK_EMAIL_MESSAGE,
  SIGNUP_WEAK_PASSWORD_MESSAGE,
} from "@/lib/server/signup-response";

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

function responseSnapshot(response: Response, payload: unknown) {
  return {
    status: response.status,
    body: payload,
    cacheControl: response.headers.get("cache-control"),
    setCookie: response.headers.getSetCookie(),
  };
}

const baseBody = {
  action: "signup" as const,
  email: "uniform-case@example.test",
  password: "long-enough-pass",
  displayName: "Member",
};

const existingEmailBody = {
  ...baseBody,
  email: "existing-user@example.test",
};

function enableStagingSignup() {
  process.env.STAGING_SIGNUP_LINK_ENABLED = "true";
  process.env.EMAIL_DELIVERY_MODE = "staging_outbox";
  process.env.APP_URL = "http://localhost:3000";
  process.env.VERCEL_ENV = "development";
  process.env.SUPABASE_SECRET_KEY = "test-service-key";
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon";
}

function mockNewStagingUser() {
  const redirectTo = "http://localhost:3000/auth/callback?next=%2Fworkspace";
  const actionLink = `http://127.0.0.1:54321/auth/v1/verify?token=secret-token&redirect_to=${encodeURIComponent(redirectTo)}`;
  generateLink.mockResolvedValueOnce({
    data: {
      user: { id: "aaaaaaaa-0000-4000-8000-000000000001" },
      properties: { action_link: actionLink },
    },
    error: null,
  });
  rpc.mockResolvedValue({ data: true, error: null });
}

function mockExistingStagingGenerateLink() {
  generateLink.mockResolvedValueOnce({
    data: { user: null, properties: {} },
    error: { message: "User already registered", code: "email_exists" },
  });
}

beforeEach(() => {
  scheduledAfter.length = 0;
  generateLink.mockReset();
  listUsers.mockReset();
  signUp.mockReset();
  resetPasswordForEmail.mockReset();
  rpc.mockReset();
  process.env = { ...env };
  vi.stubEnv("NODE_ENV", "test");
  enableStagingSignup();
  listUsers.mockResolvedValue({
    data: {
      users: [{ id: "bbbbbbbb-0000-4000-8000-000000000002", email: existingEmailBody.email }],
    },
    error: null,
  });
});

afterEach(() => {
  process.env = { ...env };
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("uniform signup responses (#95)", () => {
  it("criterion 1: new and existing emails return identical status, body, and headers", async () => {
    mockNewStagingUser();
    const newResponse = await POST(jsonRequest(baseBody));
    const newPayload = await newResponse.json();
    const newSnap = responseSnapshot(newResponse, newPayload);

    mockExistingStagingGenerateLink();
    const existingResponse = await POST(jsonRequest(existingEmailBody));
    const existingPayload = await existingResponse.json();
    const existingSnap = responseSnapshot(existingResponse, existingPayload);

    expect(existingSnap).toEqual(newSnap);
    expect(newSnap.status).toBe(200);
    expect(newSnap.body).toEqual({ data: { message: SIGNUP_CHECK_EMAIL_MESSAGE } });
    expect(newSnap.setCookie).toEqual([]);
  });

  it("returns 400 when GoTrue reports weak_password", async () => {
    delete process.env.STAGING_SIGNUP_LINK_ENABLED;
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Password should be at least 6 characters", code: "weak_password" },
    });
    const response = await POST(jsonRequest(baseBody));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toBe(SIGNUP_WEAK_PASSWORD_MESSAGE);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("criterion 2: existing-email path still invokes awaited signup generateLink", async () => {
    mockExistingStagingGenerateLink();
    await POST(jsonRequest(existingEmailBody));
    expect(generateLink).toHaveBeenCalledTimes(1);
    expect(generateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "signup",
        email: existingEmailBody.email,
      }),
    );
    expect(generateLink).not.toHaveBeenCalledWith(expect.objectContaining({ type: "magiclink" }));
  });

  it("returns 400 when GoTrue reports weak_password", async () => {
    delete process.env.STAGING_SIGNUP_LINK_ENABLED;
    signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Password should be at least 6 characters", code: "weak_password" },
    });
    const response = await POST(jsonRequest(baseBody));
    expect(response.status).toBe(400);
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("criterion 3: validation errors remain 400 for malformed signup input", async () => {
    const response = await POST(
      jsonRequest({
        action: "signup",
        email: "not-an-email",
        password: "long-enough-pass",
      }),
    );
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBeTruthy();
    expect(generateLink).not.toHaveBeenCalled();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("criterion 4: failure sending the existing-account notice does not change the HTTP response", async () => {
    mockNewStagingUser();
    const successResponse = await POST(jsonRequest(baseBody));
    const successPayload = await successResponse.json();

    mockExistingStagingGenerateLink();
    listUsers.mockImplementation(() => new Promise(() => {}));
    const noticeFailResponse = await POST(jsonRequest(existingEmailBody));
    const noticeFailPayload = await noticeFailResponse.json();

    expect(responseSnapshot(noticeFailResponse, noticeFailPayload)).toEqual(
      responseSnapshot(successResponse, successPayload),
    );
    expect(scheduledAfter.length).toBeGreaterThan(0);
  });

  it("criterion 5: server logs omit raw email addresses", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockExistingStagingGenerateLink();
    await POST(jsonRequest(existingEmailBody));
    const logText = errorSpy.mock.calls.map((call) => JSON.stringify(call)).join(" ");
    expect(logText).not.toContain(existingEmailBody.email);
    expect(logText).toMatch(/emailHash/);
  });

  it("criterion 6: staging outbox path still stores a preview for new users (#92)", async () => {
    mockNewStagingUser();
    const response = await POST(jsonRequest(baseBody));
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "store_staging_signup_notification_preview",
      expect.objectContaining({
        p_user_id: "aaaaaaaa-0000-4000-8000-000000000001",
        p_recipient_email: baseBody.email,
      }),
    );
  });

  it("B1: response returns before a never-resolving existing-account notice (standard path)", async () => {
    delete process.env.STAGING_SIGNUP_LINK_ENABLED;
    signUp.mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    });
    resetPasswordForEmail.mockImplementation(() => new Promise(() => {}));

    const response = await Promise.race([
      POST(jsonRequest(baseBody)),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error("signup response blocked on notice")), 250),
      ),
    ]);

    expect(response.status).toBe(200);
    expect(scheduledAfter).toHaveLength(1);
    const noticePromise = scheduledAfter[0]?.();
    expect(noticePromise).toBeInstanceOf(Promise);
    await expect(
      Promise.race([
        noticePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("notice_still_pending")), 50)),
      ]),
    ).rejects.toThrow("notice_still_pending");
  });
});
