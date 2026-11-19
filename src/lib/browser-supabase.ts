import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "@/lib/config";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function getBrowserSupabase() {
  if (!browserClient) {
    const { url, key } = supabaseConfig();
    browserClient = createBrowserClient(url, key, {
      auth: { flowType: "pkce" },
    });
  }
  return browserClient;
}
