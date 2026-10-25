import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

/**
 * Service-role Supabase client for trusted server jobs (the scheduled DPWH
 * sync). It bypasses Row Level Security, so it must only be used in
 * server-only code paths that have already authorized the caller (for
 * example by CRON_SECRET), and never for requests acting on behalf of a user.
 *
 * Reads SUPABASE_SECRET_KEY (sb_secret_...) or the legacy
 * SUPABASE_SERVICE_ROLE_KEY. Neither may be a NEXT_PUBLIC_ variable.
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
