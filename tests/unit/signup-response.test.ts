import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import type { AuthError } from "@supabase/supabase-js";
import {
  hashSignupIdentifier,
  isExistingAccountSignupError,
  isObfuscatedExistingSignupSuccess,
  isSignupPasswordPolicyError,
  shouldScheduleExistingAccountNotice,
} from "@/lib/server/signup-response";

function authError(code: string, message = "x"): AuthError {
  return { name: "AuthApiError", message, code, status: 422 } as AuthError;
}

function restoreEnvVar(name: string, prev: string | undefined) {
  if (prev === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = prev;
  }
}

describe("signup-response helpers", () => {
  it("matches only user_already_exists and email_exists", () => {
    expect(isExistingAccountSignupError(authError("user_already_exists"))).toBe(true);
    expect(isExistingAccountSignupError(authError("email_exists"))).toBe(true);
    expect(isExistingAccountSignupError(authError("422", "already registered"))).toBe(false);
    expect(isExistingAccountSignupError(null)).toBe(false);
  });

  it("detects obfuscated duplicate signup success", () => {
    expect(
      isObfuscatedExistingSignupSuccess({
        user: { id: "u", identities: [] } as never,
        session: null,
      }),
    ).toBe(true);
    expect(
      shouldScheduleExistingAccountNotice(null, {
        user: { id: "u", identities: [] } as never,
        session: null,
      }),
    ).toBe(true);
  });

  it("detects weak_password policy errors", () => {
    expect(isSignupPasswordPolicyError(authError("weak_password"))).toBe(true);
    expect(isSignupPasswordPolicyError(authError("user_already_exists"))).toBe(false);
  });

  it("warns once when HMAC fallback is used", async () => {
    const warnSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const prevSecret = process.env.SUPABASE_SECRET_KEY;
    const prevCron = process.env.CRON_SECRET;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.CRON_SECRET;
    vi.resetModules();
    const mod = await import("@/lib/server/signup-response");
    mod.hashSignupIdentifier("a@example.test");
    mod.hashSignupIdentifier("b@example.test");
    const fallbackCalls = warnSpy.mock.calls.filter((c) =>
      JSON.stringify(c).includes("signup_log_hmac_fallback"),
    );
    expect(fallbackCalls.length).toBe(1);
    expect(JSON.stringify(fallbackCalls)).not.toMatch(/@example\.test/);
    restoreEnvVar("SUPABASE_SECRET_KEY", prevSecret);
    restoreEnvVar("CRON_SECRET", prevCron);
    warnSpy.mockRestore();
    vi.resetModules();
    await import("@/lib/server/signup-response");
  });

  it("HMAC-hashes emails with SUPABASE_SECRET_KEY", () => {
    const prev = process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SECRET_KEY = "server-secret";
    const a = hashSignupIdentifier("Person@Example.test");
    const b = hashSignupIdentifier("person@example.test");
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{16}$/);
    restoreEnvVar("SUPABASE_SECRET_KEY", prev);
  });
});
