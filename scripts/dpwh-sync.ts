/**
 * Nationwide DPWH sync from the command line (initial import, retries).
 *
 *   npm run dpwh:sync                      # plan: validate the whole snapshot, no writes
 *   npm run dpwh:sync -- --apply           # import (resumable, idempotent)
 *
 * Options:
 *   --revision <sha> --snapshot-date <iso>  pin a snapshot (default: latest on the Hub)
 *   --apply                                 write to Supabase
 *   --force                                 re-run even if this snapshot already succeeded
 *   --resume <run id>                       continue a paused run
 *   --out <dir>                             where to write plan.json (default exports/dpwh-nationwide)
 *   --regions <list|all>                    project regions to store (default: DPWH_SYNC_REGIONS, else Visayas + Mindanao; see scope.ts)
 *   --budget-mb <n|off>                     stop before the database reaches n MB (default: SYNC_STORAGE_BUDGET_MB, else 400)
 *
 * Database access (only needed for --apply, optional for the plan):
 *   DPWH_SYNC_ADMIN_EMAIL + DPWH_SYNC_ADMIN_PASSWORD   sign in as super_admin / lgu_admin (preferred), or
 *   SUPABASE_SECRET_KEY                                server-side secret key, never NEXT_PUBLIC_
 * Values come from the process environment or .env.local and are never printed.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { planDpwhSync } from '@/lib/integrations/dpwh/nationwide/plan';
import { openSnapshot, resolveLatestSnapshot, snapshotFor, DPWH_REVIEWED_SNAPSHOT } from '@/lib/integrations/dpwh/nationwide/source';
import { supabaseSyncStore } from '@/lib/integrations/dpwh/nationwide/store';
import { runDpwhSync } from '@/lib/integrations/dpwh/nationwide/sync';
import { scopeFromEnv, storageBudgetFromEnv } from '@/lib/integrations/dpwh/nationwide/scope';

function parseArgs(argv: string[]) {
  const args = { apply: false, force: false, revision: null as string | null, snapshotDate: null as string | null, resume: null as string | null, out: 'exports/dpwh-nationwide', regions: undefined as string | undefined, budgetMb: undefined as string | undefined };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${flag} needs a value.`);
      return v;
    };
    if (flag === '--apply') args.apply = true;
    else if (flag === '--force') args.force = true;
    else if (flag === '--revision') args.revision = value();
    else if (flag === '--snapshot-date') args.snapshotDate = value();
    else if (flag === '--resume') args.resume = value();
    else if (flag === '--out') args.out = value();
    else if (flag === '--regions') args.regions = value();
    else if (flag === '--budget-mb') args.budgetMb = value();
    else throw new Error(`Unknown option "${flag}".`);
  }
  if (args.revision && !/^[0-9a-f]{40}$/.test(args.revision)) throw new Error('--revision must be a 40-character commit SHA.');
  if (args.revision && (!args.snapshotDate || Number.isNaN(Date.parse(args.snapshotDate)))) {
    throw new Error('--revision needs --snapshot-date (the commit date).');
  }
  return args;
}

async function connect(): Promise<{ client: SupabaseClient; as: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishable = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  const email = process.env.DPWH_SYNC_ADMIN_EMAIL?.trim();
  const password = process.env.DPWH_SYNC_ADMIN_PASSWORD;
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url) return null;

  if (email && password && publishable) {
    const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: true } });
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(`Sign-in failed: ${error?.message ?? 'no user'}`);
    const { data: profile } = await client.from('profiles').select('role, is_active').eq('id', data.user.id).maybeSingle();
    if (!profile?.is_active || !['super_admin', 'lgu_admin'].includes(profile.role)) {
      throw new Error('Signed-in account is not an active super_admin or lgu_admin.');
    }
    return { client, as: `${email} (${profile.role})` };
  }
  if (secret) {
    return { client: createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }), as: 'service role' };
  }
  return null;
}

async function existingHashes(client: SupabaseClient): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from('dpwh_contracts').select('contract_id, source_hash')
      .order('contract_id').range(from, from + pageSize - 1);
    if (error) throw new Error(`Reading existing contracts failed (is the migration applied?): ${error.message}`);
    for (const row of data) hashes.set(row.contract_id, row.source_hash);
    if (data.length < pageSize) return hashes;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  config({ path: '.env.local', quiet: true });

  const snapshot = args.revision ? snapshotFor(args.revision, new Date(args.snapshotDate!).toISOString()) : await resolveLatestSnapshot();
  console.log(`Dataset:   ${snapshot.dataset} / ${snapshot.file}`);
  console.log(`Snapshot:  ${snapshot.revision} (committed ${snapshot.committedAt})`);
  if (snapshot.revision !== DPWH_REVIEWED_SNAPSHOT.revision) {
    console.log(`Note: differs from the reviewed snapshot ${DPWH_REVIEWED_SNAPSHOT.revision}.`);
  }

  const db = await connect();
  console.log(`Database:  ${db ? `connected as ${db.as}` : 'not connected (plan only; expected counts assume nothing is stored)'}`);

  if (!args.apply) {
    const opened = await openSnapshot(snapshot);
    const hashes = db ? await existingHashes(db.client) : undefined;
    const started = Date.now();
    const plan = await planDpwhSync(opened, snapshot, {
      existingHashes: hashes,
      onProgress: (done) => process.stdout.write(`\r  validated ${done.toLocaleString('en-US')}/${opened.rows.toLocaleString('en-US')} rows`),
    });
    process.stdout.write('\n');
    const outDir = path.join(args.out, `${snapshot.committedAt.slice(0, 10)}-${snapshot.revision.slice(0, 10)}`);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'plan.json'), JSON.stringify(plan, null, 2) + '\n');
    const expected = plan.expected ?? { insert: plan.valid, update: 0, unchanged: 0 };
    console.log(`Rows ${plan.sourceRows}, unique IDs ${plan.uniqueContractIds}, duplicates ${plan.duplicateRows}, missing IDs ${plan.missingContractIds}`);
    console.log(`Expected: insert ${expected.insert}, update ${expected.update}, unchanged ${expected.unchanged}, rejected ${plan.rejected}` +
      (plan.expected ? '' : '  (assumes an empty table)'));
    console.log(`Validated in ${((Date.now() - started) / 1000).toFixed(0)} s. Plan written to ${path.resolve(outDir, 'plan.json')}`);
    console.log('Dry run: nothing was written. Re-run with --apply to import.');
    return;
  }

  if (!db) throw new Error('--apply needs DPWH_SYNC_ADMIN_EMAIL/DPWH_SYNC_ADMIN_PASSWORD or SUPABASE_SECRET_KEY.');
  const scopeRegions = scopeFromEnv(args.regions ?? process.env.DPWH_SYNC_REGIONS);
  const storageBudgetBytes = storageBudgetFromEnv(args.budgetMb ?? process.env.SYNC_STORAGE_BUDGET_MB);
  console.log(`Storage:   ${storageBudgetBytes === null ? 'no budget' : `stop at ${storageBudgetBytes / 1e6} MB`}`);
  const outcome = await runDpwhSync({
    store: supabaseSyncStore(db.client),
    trigger: 'cli',
    deadline: Number.POSITIVE_INFINITY,
    snapshot,
    force: args.force,
    resumeRunId: args.resume,
    scopeRegions,
    storageBudgetBytes,
    log: (message) => console.log(message),
  });
  console.log(JSON.stringify({ status: outcome.status, runId: outcome.runId, sourceRows: outcome.sourceRows, totals: outcome.totals, error: outcome.error ?? null }, null, 2));
  if (outcome.status === 'failed' || outcome.status === 'busy') process.exitCode = 1;
  await db.client.auth.signOut().catch(() => undefined);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
