import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const env = process.env;

afterEach(() => {
  process.env = { ...env };
  vi.resetModules();
});

describe("REPES contact and User-Agent", () => {
  it("embeds REPES_CONTACT in the User-Agent string", async () => {
    process.env.REPES_CONTACT = "  privacy@licitatiero.test  ";
    const { buildRepesHttpUserAgent } = await import("@/lib/server/repes-contact");
    expect(buildRepesHttpUserAgent()).toContain("contact: privacy@licitatiero.test");
  });

  it("refuses production ingest when REPES_CONTACT is unset", async () => {
    delete process.env.REPES_CONTACT;
    process.env.VERCEL_ENV = "production";
    const { assertRepesContactConfigured } = await import(
      "@/lib/server/repes-contact"
    );
    expect(() => assertRepesContactConfigured()).toThrow(/REPES_CONTACT/);
  });

  it("allows production when using fixtures without REPES_CONTACT", async () => {
    delete process.env.REPES_CONTACT;
    process.env.VERCEL_ENV = "production";
    const { assertRepesContactConfigured } = await import(
      "@/lib/server/repes-contact"
    );
    expect(() => assertRepesContactConfigured({ useFixture: true })).not.toThrow();
  });
});
