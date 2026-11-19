import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfig } from '@/lib/config';
export async function getSupabase() {
  const { url, key } = supabaseConfig();
  const store = await cookies();
  const secure = (process.env.APP_URL || 'https://').startsWith('https:');
  return createServerClient(url, key, {
    auth: { flowType: 'pkce' },
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure, path: '/' },
    cookies: {
      getAll() { return store.getAll(); },
      setAll(values) {
        try {
          for (const { name, value, options } of values) {
            store.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure });
          }
        } catch { /* Server components refresh through the request proxy. */ }
      },
    },
  });
}
