import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const recoveryMarker = /RECOVERY_CALLBACK=verified/;

function resolveLocalServiceCredentials():
  | { supabaseUrl: string; serviceKey: string }
  | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const envServiceKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (envUrl && envServiceKey) {
    const host = new URL(envUrl).hostname;
    if (host === "127.0.0.1" || host === "localhost") {
      return { supabaseUrl: envUrl, serviceKey: envServiceKey };
    }
  }
  const result = spawnSync(
    "npx",
    ["--no-install", "supabase", "status", "-o", "json"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return null;
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    return null;
  }
  const apiUrl = parsed.API_URL || parsed.api_url;
  const roleKey = parsed.SERVICE_ROLE_KEY || parsed.service_role_key;
  if (!apiUrl || !roleKey) return null;
  const host = new URL(apiUrl).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") return null;
  return { supabaseUrl: apiUrl, serviceKey: roleKey };
}

test("recovery callback accepts token_hash without the requesting browser session", async ({
  baseURL,
}, testInfo) => {
  test.skip(
    process.env.E2E_BACKEND !== "1" || testInfo.project.name !== "desktop",
    "Real local backend checked once",
  );
  const result = spawnSync(
    process.execPath,
    ["--test", "tests/integration/auth-recovery-callback.test.mjs"],
    {
      encoding: "utf8",
      timeout: 60000,
      env: { ...process.env, CI: "true", INTEGRATION_BASE_URL: baseURL },
    },
  );
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
  expect(`${result.stdout}\n${result.stderr}`).toMatch(recoveryMarker);
});

test("reset password screen shows the signed-in account email", async ({
  page,
  baseURL,
}, testInfo) => {
  const stack = resolveLocalServiceCredentials();
  test.skip(
    process.env.E2E_BACKEND !== "1" ||
      testInfo.project.name !== "desktop" ||
      !stack,
    "Real local backend with service credentials",
  );
  const testEmail = process.env.E2E_BUYER_EMAIL || "buyer@licitatiero.local";
  const admin = createClient(stack!.supabaseUrl, stack!.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: testEmail,
  });
  expect(error).toBeNull();
  const tokenHash = data?.properties?.hashed_token;
  expect(tokenHash).toBeTruthy();
  const callback = new URL("/auth/callback", baseURL);
  callback.searchParams.set("token_hash", tokenHash!);
  callback.searchParams.set("type", "recovery");
  callback.searchParams.set("next", "/account?mode=reset");
  await page.goto(callback.toString(), { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/mode=reset/);
  await expect(page.getByTestId("reset-session-email")).toContainText(testEmail);
});
