import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildContentSecurityPolicy,
  createContentSecurityPolicyNonce,
  CSP_NONCE_HEADER,
  supabaseWebSocketOrigin,
} from "@/lib/content-security-policy";
import { MAP_TILE_HOST_ALLOWLIST } from "@/lib/map-tiles";
import { proxy } from "@/proxy";
import { NextRequest } from "next/server";

const nonce = "test-nonce-value";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildContentSecurityPolicy", () => {
  it("includes nonce-based script policy and Leaflet-friendly styles", () => {
    const policy = buildContentSecurityPolicy({
      nonce,
      isDev: false,
      supabasePublicUrl: "https://project.example.supabase.co",
    });
    expect(policy).toContain(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("https://api.stripe.com");
    expect(policy).toContain("https://js.stripe.com");
    expect(policy).toContain("https://project.example.supabase.co");
    expect(policy).toContain("wss://project.example.supabase.co");
    for (const host of MAP_TILE_HOST_ALLOWLIST) {
      expect(policy).toContain(`https://${host}`);
    }
  });

  it("allows unsafe-eval in development only", () => {
    const dev = buildContentSecurityPolicy({ nonce, isDev: true });
    const prod = buildContentSecurityPolicy({ nonce, isDev: false });
    expect(dev).toContain("'unsafe-eval'");
    expect(prod).not.toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("derives local Supabase storage and websocket connect-src from env", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    const policy = buildContentSecurityPolicy({ nonce, isDev: true });
    expect(policy).toContain("http://127.0.0.1:54321");
    expect(policy).toContain("ws://127.0.0.1:54321");
    expect(supabaseWebSocketOrigin("http://127.0.0.1:54321")).toBe(
      "ws://127.0.0.1:54321",
    );
  });

  it("generates unpredictable nonces", () => {
    const a = createContentSecurityPolicyNonce();
    const b = createContentSecurityPolicyNonce();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });
});

describe("proxy Content-Security-Policy", () => {
  it("sets CSP with a script nonce on document responses", async () => {
    const response = await proxy(new NextRequest("http://localhost/"));
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    const matched = csp?.match(/'nonce-([^']+)'/);
    expect(matched?.[1]).toBeTruthy();
    expect(response.headers.get(CSP_NONCE_HEADER) ?? matched?.[1]).toBeTruthy();
    expect(csp).toContain("'strict-dynamic'");
  });
});
