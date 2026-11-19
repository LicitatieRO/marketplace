import { describe, expect, it } from "vitest";
import {
  maskActionLinksInText,
  maskUrlForDisplay,
  textContainsMaskedActionLink,
} from "@/lib/notification-preview-mask";

describe("notification preview URL masking", () => {
  it("hides query strings while keeping host and path", () => {
    const url =
      "https://supabase.example.test/auth/v1/verify?token=abc&redirect_to=https%3A%2F%2Fapp";
    expect(maskUrlForDisplay(url)).toBe(
      "https://supabase.example.test/auth/v1/verify",
    );
  });

  it("masks verify links inside preview bodies", () => {
    const body = [
      "Confirm your email:",
      "https://supabase.example.test/auth/v1/verify?token=secret",
    ].join("\n");
    expect(maskActionLinksInText(body)).toContain("/auth/v1/verify");
    expect(maskActionLinksInText(body)).not.toContain("token=secret");
  });

  it("masks token_hash query params in verify links", () => {
    const body =
      "https://supabase.example.test/auth/v1/verify?token_hash=super-secret&type=signup";
    expect(maskActionLinksInText(body)).toContain("/auth/v1/verify");
    expect(maskActionLinksInText(body)).not.toContain("token_hash");
    expect(maskActionLinksInText(body)).not.toContain("super-secret");
  });

  it("detects token_hash recovery callback links for founder reveal", () => {
    const body =
      "Reset link: https://app.example.test/auth/callback?token_hash=secret&type=recovery&next=%2Faccount";
    expect(textContainsMaskedActionLink(body)).toBe(true);
    expect(maskActionLinksInText(body)).not.toContain("token_hash=secret");
    expect(maskActionLinksInText(body)).toContain("/auth/callback");
  });

  it("masks fully percent-encoded verify links", () => {
    const encoded =
      "https%3A%2F%2Fsupabase.example.test%2Fauth%2Fv1%2Fverify%3Ftoken%3Dsecret%26type%3Dsignup";
    const masked = maskActionLinksInText(`Open ${encoded} now`);
    expect(masked).toContain("/auth/v1/verify");
    expect(masked).not.toContain("token%3D");
    expect(masked).not.toContain("secret");
  });
});
