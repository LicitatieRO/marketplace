import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isStagingDemoBannerEnabled } from "@/lib/server/demo-banner";

const env = process.env;

beforeEach(() => {
  process.env = { ...env };
});

afterEach(() => {
  process.env = { ...env };
});

describe("isStagingDemoBannerEnabled", () => {
  it("is off by default", () => {
    delete process.env.DEMO_BANNER;
    delete process.env.VERCEL_ENV;
    expect(isStagingDemoBannerEnabled()).toBe(false);
  });

  it("is off when VERCEL_ENV=production even with DEMO_BANNER=1", () => {
    process.env.DEMO_BANNER = "1";
    process.env.VERCEL_ENV = "production";
    expect(isStagingDemoBannerEnabled()).toBe(false);
  });

  it("is on when DEMO_BANNER=1 on a non-production environment", () => {
    process.env.DEMO_BANNER = "1";
    process.env.VERCEL_ENV = "preview";
    expect(isStagingDemoBannerEnabled()).toBe(true);

    process.env.VERCEL_ENV = "development";
    expect(isStagingDemoBannerEnabled()).toBe(true);
  });
});
