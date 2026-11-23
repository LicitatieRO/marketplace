import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const base = process.env.INTEGRATION_BASE_URL || "http://localhost:3000";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Recovery callback integration is restricted to a local test application.",
);

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const recoveryTemplatePath = path.join(
  repoRoot,
  "supabase/templates/recovery.html",
);

function failInCi(message) {
  if (process.env.CI) {
    assert.fail(message);
  }
}

function assertRecoveryTemplateOrFailInCi() {
  let content;
  try {
    content = readFileSync(recoveryTemplatePath, "utf8");
  } catch {
    failInCi("supabase/templates/recovery.html is missing");
    return false;
  }
  if (!content.includes("token_hash")) {
    failInCi("recovery email template must link with token_hash and type=recovery");
    return false;
  }
  return true;
}

function resolveLocalServiceCredentials() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let serviceKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (supabaseUrl && serviceKey) {
    const host = new URL(supabaseUrl).hostname;
    if (host === "127.0.0.1" || host === "localhost") {
      return { supabaseUrl, serviceKey };
    }
  }
  const result = spawnSync(
    "npx",
    ["--no-install", "supabase", "status", "-o", "json"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return null;
  }
  const apiUrl = parsed.API_URL || parsed.api_url;
  const roleKey = parsed.SERVICE_ROLE_KEY || parsed.service_role_key;
  if (!apiUrl || !roleKey) {
    return null;
  }
  const host = new URL(apiUrl).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    return null;
  }
  return { supabaseUrl: apiUrl, serviceKey: roleKey };
}

function requireRecoveryStack() {
  if (!assertRecoveryTemplateOrFailInCi()) return null;
  const creds = resolveLocalServiceCredentials();
  if (!creds || !process.env.E2E_PASSWORD) {
    failInCi(
      "Recovery callback integration requires local Supabase service credentials and E2E_PASSWORD",
    );
    return null;
  }
  return creds;
}

const testEmail = process.env.E2E_BUYER_EMAIL || "buyer@licitatiero.local";

test("recovery callback works in a fresh browser context (no PKCE verifier cookie)", async () => {
  const stack = requireRecoveryStack();
  if (!stack) return;

  const admin = createClient(stack.supabaseUrl, stack.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: testEmail,
  });
  assert.ifError(error);
  const tokenHash = data?.properties?.hashed_token;
  assert.ok(tokenHash, "generateLink must return hashed_token");
  const callback = new URL("/auth/callback", base);
  callback.searchParams.set("token_hash", tokenHash);
  callback.searchParams.set("type", "recovery");
  callback.searchParams.set("next", "/account?mode=reset");
  const response = await fetch(callback, { redirect: "manual" });
  assert.equal(response.status, 307);
  const location = response.headers.get("location") || "";
  assert.match(location, /\/account/);
  assert.match(location, /mode=reset/);

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  assert.ok(
    setCookies.some((entry) => /^sb-[^=]+-auth-token=/.test(entry)),
    "307 must set an sb-*-auth-token session cookie",
  );

  const reuse = await fetch(callback, { redirect: "manual" });
  assert.equal(reuse.status, 307);
  const reuseLocation = reuse.headers.get("location") || "";
  assert.match(reuseLocation, /error=verification/);

  console.log("RECOVERY_CALLBACK=verified");
});
