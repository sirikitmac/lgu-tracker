/**
 * Imports BetterGov.ph datasets other than the DPWH contract snapshot into
 * public.infrastructure_projects (currently: DPWH FY 2027 NEP projects).
 *
 *   npm run bettergov:sync                  # dry run: download, validate, count; no writes
 *   npm run bettergov:sync -- --apply       # import (idempotent; upsert by source + ID)
 *   npm run bettergov:sync -- --apply --force   # re-run even if this snapshot already succeeded
 *
 * Database access for --apply: SUPABASE_SECRET_KEY, or
 * DPWH_SYNC_ADMIN_EMAIL + DPWH_SYNC_ADMIN_PASSWORD of an active super_admin / lgu_admin.
 * Values come from the process environment or .env.local and are never printed.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { nepAdapter } from '@/lib/integrations/bettergov/nep/source';
import { supabaseSourceStore } from '@/lib/integrations/bettergov/store';
import { runSourceSync, type SourceAdapter } from '@/lib/integrations/bettergov/sync';

const ADAPTERS: SourceAdapter[] = [nepAdapter];

async function connect(): Promise<SupabaseClient | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishable = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  const email = process.env.DPWH_SYNC_ADMIN_EMAIL?.trim();
  const password = process.env.DPWH_SYNC_ADMIN_PASSWORD;
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url) return null;
  if (email && password && publishable) {
    const client = createClient(url, publishable, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Sign-in failed: ${error.message}`);
    return client;
  }
  if (secret) return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  return null;
}

async function main() {
  const argv = process.argv.slice(2);
  for (const flag of argv) if (!['--apply', '--force'].includes(flag)) throw new Error(`Unknown option "${flag}".`);
  const apply = argv.includes('--apply');
  config({ path: '.env.local', quiet: true });

  if (!apply) {
    for (const adapter of ADAPTERS) {
      const snapshot = await adapter.resolveSnapshot();
      const rows = await adapter.readRows(snapshot);
      const results = rows.map((r) => adapter.normalize(r));
      const ok = results.filter((r) => r.ok);
      const ids = new Set(ok.map((r) => (r.ok ? r.record.source_id : '')));
      const byCategory = new Map<string, number>();
      for (const r of ok) if (r.ok) byCategory.set(r.record.category, (byCategory.get(r.record.category) ?? 0) + 1);
      console.log(`${adapter.source}: ${snapshot.dataset}/${snapshot.file} @ ${snapshot.revision} (${snapshot.committedAt})`);
      console.log(`  rows ${rows.length}, valid ${ok.length}, unique IDs ${ids.size}, rejected ${rows.length - ok.length}`);
      console.log(`  categories ${JSON.stringify(Object.fromEntries(byCategory))}`);
    }
    console.log('Dry run: nothing was written. Re-run with --apply to import.');
    return;
  }

  const client = await connect();
  if (!client) throw new Error('--apply needs SUPABASE_SECRET_KEY or DPWH_SYNC_ADMIN_EMAIL/DPWH_SYNC_ADMIN_PASSWORD.');
  const store = supabaseSourceStore(client);
  for (const adapter of ADAPTERS) {
    const outcome = await runSourceSync({ store, adapter, trigger: 'cli', force: argv.includes('--force'), log: (m) => console.log(m) });
    console.log(JSON.stringify(outcome, null, 2));
    if (outcome.status === 'failed') process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
