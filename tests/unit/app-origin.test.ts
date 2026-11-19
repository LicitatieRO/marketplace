import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { buildRecoveryCallbackUrl, configuredSiteOrigin } from "@/lib/server/app-origin";

const env = process.env;

beforeEach(() => {
  process.env = { ...env };
});

afterEach(() => {
  process.env = { ...env };
});

describe("configuredSiteOrigin", () => {
  it("reads APP_URL and ignores trailing slash on the value", () => {
    process.env.APP_URL = "https://licitatiero-staging.vercel.app/";
    expect(configuredSiteOrigin()).toBe("https://licitatiero-staging.vercel.app");
  });

  it("falls back to NEXT_PUBLIC_SITE_URL when APP_URL is unset", () => {
    delete process.env.APP_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.example.test";
    expect(configuredSiteOrigin()).toBe("https://app.example.test");
  });
});

describe("buildRecoveryCallbackUrl", () => {
  it("builds token_hash callback without double slashes and encodes next", () => {
    process.env.APP_URL = "https://licitatiero-staging.vercel.app/";
    const url = buildRecoveryCallbackUrl("hashed-token-value");
    expect(url).toBe(
      "https://licitatiero-staging.vercel.app/auth/callback?token_hash=hashed-token-value&type=recovery&next=%2Faccount%3Fmode%3Dreset",
    );
    expect(url).not.toMatch(/\/\/auth\/callback/);
  });

  it("does not use a hostile Host-derived origin", () => {
    process.env.APP_URL = "https://licitatiero-staging.vercel.app";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    const url = buildRecoveryCallbackUrl("tok");
    expect(url?.startsWith("https://evil.test/")).toBe(false);
    expect(url).toContain("licitatiero-staging.vercel.app");
  });
});
