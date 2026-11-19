import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/config';

export function serviceRoleClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error('SUPABASE_SECRET_KEY is required for server-side Supabase RPC.');
  }
  const { url } = supabaseConfig();
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}