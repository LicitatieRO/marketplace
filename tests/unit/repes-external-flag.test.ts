import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { isRepesExternalAuctionsEnabled } from "@/lib/server/repes-external-flag";

const env = process.env;
const STAGING = "licitatiero-staging.vercel.app";

afterEach(() => {
  process.env = { ...env };
});

describe("isRepesExternalAuctionsEnabled", () => {
  it("is off by default", () => {
    delete process.env.REPES_EXTERNAL_AUCTIONS_ENABLED;
    expect(isRepesExternalAuctionsEnabled(undefined)).toBe(false);
  });

  it("requires lowercase literal true", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.REPES_EXTERNAL_AUCTIONS_ENABLED = "TRUE";
    expect(isRepesExternalAuctionsEnabled(undefined)).toBe(false);
    process.env.REPES_EXTERNAL_AUCTIONS_ENABLED = "true";
    expect(isRepesExternalAuctionsEnabled(undefined)).toBe(true);
  });

  it("fails closed on production without staging allowlist", () => {
    process.env.REPES_EXTERNAL_AUCTIONS_ENABLED = "true";
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = "https://licitatiero.ro";
    expect(isRepesExternalAuctionsEnabled(STAGING)).toBe(false);
  });

  it("allows production when APP_URL and Host match staging allowlist", () => {
    process.env.REPES_EXTERNAL_AUCTIONS_ENABLED = "true";
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = `https://${STAGING}`;
    expect(isRepesExternalAuctionsEnabled(STAGING)).toBe(true);
  });
});