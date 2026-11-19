import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const base = process.env.INTEGRATION_BASE_URL || "http://localhost:3000";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Recovery outbox integration is restricted to a local test application.",
);

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

function requireOutboxStack(t) {
  if (process.env.APP_SENT_RECOVERY_ENABLED !== "true") {
    const message =
      "Recovery outbox integration requires APP_SENT_RECOVERY_ENABLED=true on the application server";
    if (process.env.CI) {
      assert.fail(message);
    }
    t.skip(message);
    return null;
  }
  const creds = resolveLocalServiceCredentials();
  if (!creds || !process.env.E2E_PASSWORD) {
    const message =
      "Recovery outbox integration requires local Supabase service credentials and E2E_PASSWORD";
    if (process.env.CI) {
      assert.fail(message);
    }
    t.skip(message);
    return null;
  }
  return creds;
}

const testEmail = process.env.E2E_BUYER_EMAIL || "buyer@licitatiero.local";

function extractRecoveryLink(body) {
  const match = body.match(/https?:\/\/[^\s]+auth\/callback\?[^\s]+/);
  return match?.[0] ?? null;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRecoveryPreview(admin) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data: previews, error: listError } = await admin.rpc(
      "list_notification_previews",
      { p_limit: 30 },
    );
    assert.ifError(listError);
    const row = (previews ?? []).find(
      (p) =>
        typeof p?.subject === "string" &&
        p.subject.includes("resetează parola") &&
        typeof p?.body === "string" &&
        p.body.includes("token_hash="),
    );
    if (row) return row;
    await sleep(250);
  }
  return null;
}

test("app-sent recovery stores a token_hash preview and the link opens reset mode", async (t) => {
  const stack = requireOutboxStack(t);
  if (!stack) return;

  const origin = new URL(base).origin;
  const recoverResponse = await fetch(`${origin}/api/auth`, {
    method: "POST",
    headers: {
      Origin: origin,
      Host: new URL(origin).host,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "recover", email: testEmail }),
  });
  assert.equal(recoverResponse.status, 200);

  const admin = createClient(stack.supabaseUrl, stack.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const row = await waitForRecoveryPreview(admin);
  assert.ok(
    row,
    "expected a recovery preview with token_hash callback in the outbox",
  );
  const link = extractRecoveryLink(row.body);
  assert.ok(link, "preview body must include the app callback URL");

  const isolated = await fetch(link, { redirect: "manual" });
  assert.equal(isolated.status, 307);
  const location = isolated.headers.get("location") || "";
  assert.match(location, /\/account/);
  assert.match(location, /mode=reset/);

  console.log("RECOVERY_OUTBOX=verified");
});
