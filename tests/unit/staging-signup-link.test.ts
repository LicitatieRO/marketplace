import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertStagingHostForActionLinkPreview,
  isStagingSignupLinkEnabled,
  signupActionLinkAllowed,
  strictTruthyEnv,
} from "@/lib/server/staging-signup-link";

const env = process.env;
const STAGING = "licitatiero-staging.vercel.app";

function enableFlags() {
  process.env.STAGING_SIGNUP_LINK_ENABLED = "true";
  process.env.EMAIL_DELIVERY_MODE = "staging_outbox";
}

afterEach(() => {
  process.env = { ...env };
  vi.unstubAllEnvs();
});

describe("staging sign-up link gate (fail-closed)", () => {
  it("blocks when STAGING_SIGNUP_LINK_ENABLED is off", () => {
    enableFlags();
    delete process.env.STAGING_SIGNUP_LINK_ENABLED;
    expect(isStagingSignupLinkEnabled(STAGING)).toBe(false);
  });

  it("blocks when EMAIL_DELIVERY_MODE is not staging_outbox", () => {
    process.env.STAGING_SIGNUP_LINK_ENABLED = "true";
    process.env.EMAIL_DELIVERY_MODE = "resend";
    expect(isStagingSignupLinkEnabled(STAGING)).toBe(false);
  });

  it("blocks prod with non-allowlisted host", () => {
    enableFlags();
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = `https://${STAGING}`;
    expect(isStagingSignupLinkEnabled("licitatiero.ro")).toBe(false);
  });

  it("blocks prod with missing request host", () => {
    enableFlags();
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = `https://${STAGING}`;
    expect(isStagingSignupLinkEnabled("")).toBe(false);
    expect(isStagingSignupLinkEnabled(undefined)).toBe(false);
    expect(isStagingSignupLinkEnabled(null)).toBe(false);
  });

  it("allows prod with allowlisted APP_URL and matching host", () => {
    enableFlags();
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = `https://${STAGING}`;
    expect(isStagingSignupLinkEnabled(STAGING)).toBe(true);
  });

  it("allows non-prod when flags are set", () => {
    enableFlags();
    process.env.VERCEL_ENV = "preview";
    expect(isStagingSignupLinkEnabled(undefined)).toBe(true);
    expect(isStagingSignupLinkEnabled("any-host.example")).toBe(true);
  });

  it("blocks prod when APP_URL host is not allowlisted", () => {
    enableFlags();
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = "https://licitatiero.ro";
    expect(isStagingSignupLinkEnabled(STAGING)).toBe(false);
  });

  it("treats NODE_ENV=production without VERCEL_ENV as production runtime", () => {
    enableFlags();
    delete process.env.VERCEL_ENV;
    process.env.APP_URL = `https://${STAGING}`;
    vi.stubEnv("NODE_ENV", "production");
    expect(isStagingSignupLinkEnabled(STAGING)).toBe(true);
    expect(isStagingSignupLinkEnabled(undefined)).toBe(false);
  });

  it("blocks production when APP_URL is missing", () => {
    enableFlags();
    process.env.VERCEL_ENV = "production";
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(isStagingSignupLinkEnabled(STAGING)).toBe(false);
  });

  it("rejects non-literal true flag values", () => {
    enableFlags();
    process.env.STAGING_SIGNUP_LINK_ENABLED = "TRUE";
    expect(isStagingSignupLinkEnabled(STAGING)).toBe(false);
    process.env.STAGING_SIGNUP_LINK_ENABLED = "1";
    expect(isStagingSignupLinkEnabled(STAGING)).toBe(false);
    expect(strictTruthyEnv("STAGING_SIGNUP_LINK_ENABLED")).toBe(false);
  });

  it("ignores NEXT_PUBLIC_APP_URL when APP_URL is unset", () => {
    enableFlags();
    process.env.VERCEL_ENV = "production";
    delete process.env.APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = `https://${STAGING}`;
    expect(isStagingSignupLinkEnabled(STAGING)).toBe(false);
  });
});

const TEST_SUPABASE_AUTH_HOST = "supabase-auth.fixture.test";

describe("signupActionLinkAllowed", () => {
  afterEach(() => {
    process.env = { ...env };
  });

  function enableLinkAllowlist() {
    process.env.APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${TEST_SUPABASE_AUTH_HOST}`;
  }

  it("rejects redirect_to host mismatch", () => {
    enableLinkAllowlist();
    const redirect = "http://localhost:3000/auth/callback?next=%2F";
    const link =
      `https://${TEST_SUPABASE_AUTH_HOST}/verify?redirect_to=` +
      encodeURIComponent("https://evil.example/phish");
    expect(signupActionLinkAllowed(link, redirect)).toBe(false);
  });

  it("accepts matching redirect_to host on allowlisted auth host", () => {
    enableLinkAllowlist();
    const redirect = "http://localhost:3000/auth/callback?next=%2F";
    const link =
      `https://${TEST_SUPABASE_AUTH_HOST}/verify?redirect_to=` +
      encodeURIComponent(redirect);
    expect(signupActionLinkAllowed(link, redirect)).toBe(true);
  });

  it("rejects action link on non-allowlisted host", () => {
    enableLinkAllowlist();
    const redirect = "http://localhost:3000/auth/callback?next=%2F";
    const link =
      "https://evil-auth.fixture.test/verify?redirect_to=" +
      encodeURIComponent(redirect);
    expect(signupActionLinkAllowed(link, redirect)).toBe(false);
  });

  it("rejects action link when redirect_to is missing", () => {
    enableLinkAllowlist();
    const redirect = "http://localhost:3000/auth/callback?next=%2F";
    const link = `https://${TEST_SUPABASE_AUTH_HOST}/verify`;
    expect(signupActionLinkAllowed(link, redirect)).toBe(false);
  });

  it("rejects https links when APP_URL is missing", () => {
    delete process.env.APP_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${TEST_SUPABASE_AUTH_HOST}`;
    const redirect = "http://localhost:3000/auth/callback?next=%2F";
    const link =
      `https://${TEST_SUPABASE_AUTH_HOST}/auth/v1/verify?redirect_to=` +
      encodeURIComponent(redirect);
    expect(signupActionLinkAllowed(link, redirect)).toBe(false);
  });

  it("rejects userinfo in action links", () => {
    enableLinkAllowlist();
    const redirect = "http://localhost:3000/auth/callback?next=%2F";
    const link =
      `https://evil%40host@${TEST_SUPABASE_AUTH_HOST}/auth/v1/verify?redirect_to=` +
      encodeURIComponent(redirect);
    expect(signupActionLinkAllowed(link, redirect)).toBe(false);
  });

  it("rejects suffix-host attacks", () => {
    enableLinkAllowlist();
    const redirect = "http://localhost:3000/auth/callback?next=%2F";
    const evilHosts = [
      "evil-supabase.co",
      "supabase.co.evil.com",
      `${TEST_SUPABASE_AUTH_HOST}.evil.com`,
    ];
    for (const host of evilHosts) {
      const link =
        `https://${host}/auth/v1/verify?redirect_to=` +
        encodeURIComponent(redirect);
      expect(signupActionLinkAllowed(link, redirect)).toBe(false);
    }
  });

  it("rejects port mismatch against APP_URL", () => {
    process.env.APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:54321`;
    const redirect = "http://localhost:3001/auth/callback?next=%2F";
    const link =
      "http://127.0.0.1:54321/auth/v1/verify?redirect_to=" +
      encodeURIComponent(redirect);
    expect(signupActionLinkAllowed(link, redirect)).toBe(false);
  });

  it("rejects non-local http scheme on production runtime", () => {
    enableLinkAllowlist();
    process.env.VERCEL_ENV = "production";
    const redirect = "http://localhost:3000/auth/callback?next=%2F";
    const link =
      `http://${TEST_SUPABASE_AUTH_HOST}/auth/v1/verify?redirect_to=` +
      encodeURIComponent(redirect);
    expect(signupActionLinkAllowed(link, redirect)).toBe(false);
  });

  it("blocks action-link previews when APP_URL is not a staging host", () => {
    process.env.APP_URL = "https://licitatiero-production.vercel.app";
    expect(() => assertStagingHostForActionLinkPreview()).toThrow();
  });

  it("requires https in production for allowlisted hosts", () => {
    process.env.APP_URL = "https://licitatiero-staging.vercel.app";
    process.env.NEXT_PUBLIC_SUPABASE_URL = `https://${TEST_SUPABASE_AUTH_HOST}`;
    process.env.VERCEL_ENV = "production";
    const redirect =
      "https://licitatiero-staging.vercel.app/auth/callback?next=%2F";
    const link =
      `https://${TEST_SUPABASE_AUTH_HOST}/auth/v1/verify?redirect_to=` +
      encodeURIComponent(redirect);
    expect(signupActionLinkAllowed(link, redirect)).toBe(true);
  });
});