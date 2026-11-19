import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canUnlinkIdentity,
  isAuthProviderEnabled,
  OAUTH_PROVIDER_SCOPES,
  oauthCallbackRedirect,
  startOAuthSignIn,
  type OAuthProviderId,
} from "@/lib/auth-oauth";

const baseEnv = { ...process.env };

afterEach(() => {
  process.env = { ...baseEnv };
  vi.resetModules();
});

describe("auth OAuth provider gating", () => {
  const providers: OAuthProviderId[] = ["google", "apple", "facebook"];

  it("treats unset flags as disabled", () => {
    for (const provider of providers) {
      expect(isAuthProviderEnabled(provider)).toBe(false);
    }
  });

  it("enables only when the flag is the lowercase literal true", () => {
    process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED = "true";
    expect(isAuthProviderEnabled("google")).toBe(true);
    process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED = "TRUE";
    expect(isAuthProviderEnabled("google")).toBe(false);
  });

  it("does not call signInWithOAuth when disabled", async () => {
    const signInWithOAuth = vi.fn();
    const result = await startOAuthSignIn(
      { auth: { signInWithOAuth } },
      "google",
      "http://localhost:3000/auth/callback?next=%2F",
    );
    expect(result.started).toBe(false);
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it("calls signInWithOAuth with minimal scopes and redirect when enabled", async () => {
    process.env.NEXT_PUBLIC_AUTH_FACEBOOK_ENABLED = "true";
    const signInWithOAuth = vi.fn(async () => ({ error: null }));
    const redirectTo = oauthCallbackRedirect(
      "http://localhost:3000",
      "/workspace",
    );
    const result = await startOAuthSignIn(
      { auth: { signInWithOAuth } },
      "facebook",
      redirectTo,
    );
    expect(result.started).toBe(true);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "facebook",
      options: {
        redirectTo,
        scopes: OAUTH_PROVIDER_SCOPES.facebook,
      },
    });
  });
});

describe("canUnlinkIdentity", () => {
  it("blocks unlinking the last sign-in method", () => {
    expect(
      canUnlinkIdentity([
        { id: "a", provider: "google", identity_id: "gid" },
      ]),
    ).toBe(false);
  });

  it("allows unlink when another method remains", () => {
    expect(
      canUnlinkIdentity([
        { id: "a", provider: "google", identity_id: "gid" },
        { id: "b", provider: "email", identity_id: "eid" },
      ]),
    ).toBe(true);
  });
});
