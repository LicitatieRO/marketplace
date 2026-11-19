import { afterEach, describe, expect, it, vi } from "vitest";
import { isPocSwitcherServerEnabled } from "@/lib/server/poc-switcher";

const env = process.env;
const STAGING = "licitatiero-staging.vercel.app";

afterEach(() => {
  process.env = { ...env };
  vi.unstubAllEnvs();
});

describe("POC switcher server gate (fail-closed)", () => {
  it("allows prod + POC_SWITCHER_ENABLED + matching staging hosts", () => {
    process.env.VERCEL_ENV = "production";
    process.env.POC_SWITCHER_ENABLED = "true";
    process.env.APP_URL = `https://${STAGING}`;
    expect(isPocSwitcherServerEnabled(STAGING)).toBe(true);
  });

  it("blocks prod + flag + wrong or missing request host", () => {
    process.env.VERCEL_ENV = "production";
    process.env.POC_SWITCHER_ENABLED = "true";
    process.env.APP_URL = `https://${STAGING}`;
    expect(isPocSwitcherServerEnabled("licitatiero.ro")).toBe(false);
    expect(isPocSwitcherServerEnabled("")).toBe(false);
    expect(isPocSwitcherServerEnabled(undefined)).toBe(false);
    expect(isPocSwitcherServerEnabled(null)).toBe(false);
  });

  it("blocks prod + flag when APP_URL host is not allowlisted", () => {
    process.env.VERCEL_ENV = "production";
    process.env.POC_SWITCHER_ENABLED = "true";
    process.env.APP_URL = "https://licitatiero.ro";
    expect(isPocSwitcherServerEnabled(STAGING)).toBe(false);
  });

  it("blocks prod without POC_SWITCHER_ENABLED", () => {
    process.env.VERCEL_ENV = "production";
    process.env.APP_URL = `https://${STAGING}`;
    delete process.env.POC_SWITCHER_ENABLED;
    expect(isPocSwitcherServerEnabled(STAGING)).toBe(false);
  });

  it("allows non-prod runtime with POC_SWITCHER_ENABLED", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.POC_SWITCHER_ENABLED = "true";
    expect(isPocSwitcherServerEnabled(undefined)).toBe(true);
    process.env.VERCEL_ENV = "development";
    expect(isPocSwitcherServerEnabled("any-host.example")).toBe(true);
  });

  it("treats NODE_ENV=production without VERCEL_ENV as production runtime", () => {
    delete process.env.VERCEL_ENV;
    vi.stubEnv("NODE_ENV", "production");
    process.env.POC_SWITCHER_ENABLED = "true";
    process.env.APP_URL = "https://licitatiero.ro";
    expect(isPocSwitcherServerEnabled("localhost")).toBe(false);
    process.env.APP_URL = "http://localhost:3000";
    expect(isPocSwitcherServerEnabled("localhost:3000")).toBe(true);
  });
});