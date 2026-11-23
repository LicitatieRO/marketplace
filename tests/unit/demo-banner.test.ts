import { afterEach, describe, expect, it, vi } from "vitest";
import { isStagingDemoBannerEnabled } from "@/lib/server/demo-banner";

const env = process.env;
const STAGING = "licitatiero-staging.vercel.app";

afterEach(() => {
  process.env = { ...env };
  vi.unstubAllEnvs();
});

describe("isStagingDemoBannerEnabled", () => {
  it("is off by default", () => {
    delete process.env.DEMO_BANNER;
    delete process.env.VERCEL_ENV;
    expect(isStagingDemoBannerEnabled(undefined)).toBe(false);
    expect(isStagingDemoBannerEnabled(STAGING)).toBe(false);
  });

  it("is off when DEMO_BANNER is unset, empty, or not exactly 1", () => {
    process.env.VERCEL_ENV = "preview";
    delete process.env.DEMO_BANNER;
    expect(isStagingDemoBannerEnabled(undefined)).toBe(false);

    process.env.DEMO_BANNER = "";
    expect(isStagingDemoBannerEnabled(undefined)).toBe(false);

    process.env.DEMO_BANNER = "true";
    expect(isStagingDemoBannerEnabled(undefined)).toBe(false);
  });

  it("is on when DEMO_BANNER=1 on a non-production environment", () => {
    process.env.DEMO_BANNER = "1";
    process.env.VERCEL_ENV = "preview";
    expect(isStagingDemoBannerEnabled(undefined)).toBe(true);

    process.env.VERCEL_ENV = "development";
    expect(isStagingDemoBannerEnabled("any-host.example")).toBe(true);
  });

  it("is off on production runtime without a matching staging host", () => {
    process.env.DEMO_BANNER = "1";
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = "https://licitatiero.ro";
    expect(isStagingDemoBannerEnabled(STAGING)).toBe(false);
    expect(isStagingDemoBannerEnabled(undefined)).toBe(false);
    expect(isStagingDemoBannerEnabled(null)).toBe(false);
    expect(isStagingDemoBannerEnabled("")).toBe(false);
  });

  it("is on on production runtime with flag and matching staging hosts", () => {
    process.env.DEMO_BANNER = "1";
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = `https://${STAGING}`;
    expect(isStagingDemoBannerEnabled(STAGING)).toBe(true);
  });

  it("blocks production runtime when APP_URL host is not allowlisted", () => {
    process.env.DEMO_BANNER = "1";
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = "https://licitatiero.ro";
    expect(isStagingDemoBannerEnabled(STAGING)).toBe(false);
  });

  it("blocks production runtime when request host does not match", () => {
    process.env.DEMO_BANNER = "1";
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = `https://${STAGING}`;
    expect(isStagingDemoBannerEnabled("licitatiero.ro")).toBe(false);
  });

  it("treats NODE_ENV=production without VERCEL_ENV as production runtime", () => {
    delete process.env.VERCEL_ENV;
    vi.stubEnv("NODE_ENV", "production");
    process.env.DEMO_BANNER = "1";
    process.env.APP_URL = "https://licitatiero.ro";
    expect(isStagingDemoBannerEnabled("localhost")).toBe(false);
    process.env.APP_URL = "http://localhost:3000";
    expect(isStagingDemoBannerEnabled("localhost:3000")).toBe(true);
  });
});
