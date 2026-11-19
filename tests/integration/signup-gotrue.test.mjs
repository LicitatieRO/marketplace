import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function assertClientOrFailInCi(t, client) {
  if (client) return client;
  if (process.env.CI) {
    assert.fail("Local Supabase anon client unavailable in CI");
  }
  t.skip("Local Supabase anon client unavailable");
  return null;
}

function resolveLocalAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (url && anon) {
    const host = new URL(url).hostname;
    if (host === "127.0.0.1" || host === "localhost") {
      return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    }
  }
  const result = spawnSync("npx", ["--no-install", "supabase", "status", "-o", "json"], {
    encoding: "utf8",
  });
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
  const anonKey = parsed.ANON_KEY || parsed.anon_key;
  if (!apiUrl || !anonKey) return null;
  const host = new URL(apiUrl).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") return null;
  return createClient(apiUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const redirect = "http://localhost:3000/auth/callback?next=%2Fworkspace";

test("GoTrue duplicate signUp for confirmed email (confirmations ON)", async (t) => {
  const client = assertClientOrFailInCi(t, resolveLocalAnonClient());
  if (!client) return;

  const email = "owner@licitatiero.local";
  const password = "probe-signup-password-12";
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirect },
  });

  if (error) {
    assert.ok(
      error.code === "user_already_exists" || error.code === "email_exists",
      `unexpected GoTrue error code: ${error.code ?? "none"} (${error.message ?? ""})`,
    );
    process.stdout.write(`SIGNUP_GOTRUE_BRANCH=error_code:${error.code}\n`);
    return;
  }

  assert.equal(data.session, null, "duplicate signUp must not create a session");
  const obfuscated = (data.user?.identities?.length ?? 0) === 0;
  assert.ok(obfuscated, "expected obfuscated user (empty identities) for existing confirmed email");
  process.stdout.write("SIGNUP_GOTRUE_BRANCH=obfuscated_success\n");
});

test("GoTrue weak password vs duplicate order (existing confirmed email)", async (t) => {
  const client = assertClientOrFailInCi(t, resolveLocalAnonClient());
  if (!client) return;

  const email = "owner@licitatiero.local";
  const tooShortForGotrue = "short";
  const { error: existingWeak } = await client.auth.signUp({
    email,
    password: tooShortForGotrue,
    options: { emailRedirectTo: redirect },
  });

  const code = existingWeak?.code ?? "none";
  process.stdout.write(`SIGNUP_GOTRUE_WEAK_PASSWORD_EXISTING=${code}\n`);

  const novel = `probe-weak-${Date.now()}@example.test`;
  const { error: novelWeak } = await client.auth.signUp({
    email: novel,
    password: tooShortForGotrue,
    options: { emailRedirectTo: redirect },
  });
  process.stdout.write(
    `SIGNUP_GOTRUE_WEAK_PASSWORD_NEW=${novelWeak?.code ?? "none"}\n`,
  );

  assert.equal(code, novelWeak?.code ?? "none", "expected the same GoTrue error for existing and new email");
});
