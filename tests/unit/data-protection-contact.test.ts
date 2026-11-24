import { afterEach, describe, expect, it } from "vitest";
import {
  DATA_PROTECTION_CONTACT_FALLBACK_EN,
  DATA_PROTECTION_CONTACT_FALLBACK_RO,
  dataProtectionContactText,
  isDataProtectionContactConfigured,
} from "@/lib/data-protection-contact";

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
});

describe("data-protection contact helpers", () => {
  it("returns POC fallback sentences when env is unset", () => {
    delete process.env.DATA_PROTECTION_CONTACT;
    delete process.env.NEXT_PUBLIC_DATA_PROTECTION_CONTACT;
    expect(isDataProtectionContactConfigured()).toBe(false);
    expect(dataProtectionContactText("ro")).toBe(
      DATA_PROTECTION_CONTACT_FALLBACK_RO,
    );
    expect(dataProtectionContactText("en")).toBe(
      DATA_PROTECTION_CONTACT_FALLBACK_EN,
    );
  });

  it("returns configured contact when set", () => {
    process.env.DATA_PROTECTION_CONTACT = "privacy@example.test";
    expect(isDataProtectionContactConfigured()).toBe(true);
    expect(dataProtectionContactText("en")).toBe("privacy@example.test");
  });
});
