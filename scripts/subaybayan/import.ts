/**
 * Imports the SubayBAYAN pipeline output into Supabase (server-side only).
 *
 *   npm run subaybayan:import -- --dry-run          # read-only: what would change
 *   npm run subaybayan:import -- --limit 100        # first 100 rows, then verify
 *   npm run subaybayan:import                       # everything
 *
 * Options:
 *   --limit <n>        only the first n rows (and their duplicate flags)
 *   --dry-run          compare with the database, write nothing
 *   --budget-mb <n|off> stop before the database passes n MB (default SYNC_STORAGE_BUDGET_MB, else 400)
 *   --skip-matches     do not load the DPWH duplicate flags
 *
 * Inputs: .cache/subaybayan/out/subaybayan_projects.jsonl (npm run subaybayan:build)
 *         .cache/subaybayan/out/dpwh_matches.jsonl        (npm run subaybayan:dedupe)
 * Needs SUBAYBAYAN target tables (migration 20261103000100) and SUPABASE_SECRET_KEY in
 * .env.local (never NEXT_PUBLIC_; never printed).
 *
 * Idempotent: rows are upserted on id in batches of 1,000; rows whose
 * source_hash is unchanged are skipped. Writes only subaybayan_projects and
 * subaybayan_dpwh_matches. dpwh_contracts is only counted, before and after.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { storageBudgetFromEnv } from '@/lib/integrations/dpwh/nationwide/scope';
import type { ProjectRow } from './lib/records';

const OUT = '.cache/subaybayan/out';
const BATCH = 1000;

interface MatchRow {
  subaybayan_id: string;
  dpwh_contract_id: string;
  match_class: 'exact' | 'potential';
  rank: number;
  score: number;
  reasons: string[];
  evidence: Record<string, unknown>;
}

function parseArgs(argv: string[]) {
  const args = { limit: null as number | null, dryRun: false, budgetMb: undefined as string | undefined, skipMatches: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${flag} needs a value.`);
      return v;
    };
    if (flag === '--limit') {
      args.limit = Number(value());
      if (!Number.isInteger(args.limit) || args.limit < 1) throw new Error('--limit must be a positive integer.');
    } else if (flag === '--dry-run') args.dryRun = true;
    else if (flag === '--budget-mb') args.budgetMb = value();
    else if (flag === '--skip-matches') args.skipMatches = true;
    else throw new Error(`Unknown option "${flag}".`);
  }
  return args;
}

const readJsonl = <T,>(file: string): T[] =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);

const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;

async function dbBytes(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc('sync_storage_usage');
  if (error) throw new Error(`Reading database size failed: ${error.message}`);
  return Number(data);
}

async function countRows(client: SupabaseClient, table: string): Promise<number | null> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) return null;
  return count;
}

async function existingHashes(client: SupabaseClient): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let last = '';
  for (;;) {
    let q = client.from('subaybayan_projects').select('id, source_hash').order('id').limit(BATCH);
    if (last) q = q.gt('id', last);
    const { data, error } = await q;
    if (error) throw new Error(`Reading existing rows failed: ${error.message}`);
    for (const r of data) out.set(r.id, r.source_hash);
    if (data.length < BATCH) return out;
    last = data[data.length - 1].id;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  config({ path: '.env.local', quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secret) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required (in .env.local).');
  const projectsFile = path.join(OUT, 'subaybayan_projects.jsonl');
  if (!existsSync(projectsFile)) throw new Error(`${projectsFile} not found. Run npm run subaybayan:build first.`);

  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const budget = storageBudgetFromEnv(args.budgetMb ?? process.env.SYNC_STORAGE_BUDGET_MB);

  // Preconditions: the migration is applied.
  const probe = await client.from('subaybayan_projects').select('id').limit(1);
  if (probe.error) {
    throw new Error(
      `Table public.subaybayan_projects is not reachable (${probe.error.message}). ` +
        'Apply supabase/migrations/20261103000100_subaybayan_projects.sql first (npx supabase db push --linked, or paste it into the SQL editor).'
    );
  }

  let rows = readJsonl<ProjectRow>(projectsFile);
  if (args.limit) rows = rows.slice(0, args.limit);
  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) throw new Error('Pipeline output has duplicate ids; re-run npm run subaybayan:build.');

  const sizeBefore = await dbBytes(client);
  const dpwhBefore = await countRows(client, 'dpwh_contracts');
  console.log(`Database size before: ${mb(sizeBefore)}${budget ? ` (budget ${mb(budget)})` : ''}. dpwh_contracts: ${dpwhBefore?.toLocaleString('en-US')}.`);

  const hashes = await existingHashes(client);
  const changed = rows.filter((r) => hashes.get(r.id) !== r.source_hash);
  const inserts = changed.filter((r) => !hashes.has(r.id)).length;
  console.log(`Rows: ${rows.length.toLocaleString('en-US')} · new ${inserts.toLocaleString('en-US')} · changed ${(changed.length - inserts).toLocaleString('en-US')} · unchanged ${(rows.length - changed.length).toLocaleString('en-US')}`);

  // Rough projection (≈1.1 KB per row with indexes) so an obviously-too-big import stops before writing.
  const projected = sizeBefore + inserts * 1100;
  if (budget && projected > budget) throw new Error(`Projected size ${mb(projected)} exceeds the budget ${mb(budget)}. Nothing written.`);

  const matchesFile = path.join(OUT, 'dpwh_matches.jsonl');
  const matches = !args.skipMatches && existsSync(matchesFile) ? readJsonl<MatchRow>(matchesFile).filter((m) => ids.has(m.subaybayan_id)) : [];

  if (args.dryRun) {
    console.log(`Dry run: would upsert ${changed.length.toLocaleString('en-US')} rows and ${matches.length} duplicate flags. Nothing written.`);
    return;
  }

  let written = 0;
  for (let i = 0; i < changed.length; i += BATCH) {
    const batch = changed.slice(i, i + BATCH);
    const { error } = await client.from('subaybayan_projects').upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`Upsert failed at row ${i}: ${error.message}`);
    written += batch.length;
    process.stdout.write(`\r  upserted ${written.toLocaleString('en-US')}/${changed.length.toLocaleString('en-US')}`);
    if (budget && (i / BATCH) % 5 === 4) {
      const now = await dbBytes(client);
      if (now > budget) throw new Error(`\nStopped: database is ${mb(now)}, over the budget ${mb(budget)}. Re-running resumes (unchanged rows are skipped).`);
    }
  }
  if (changed.length) process.stdout.write('\n');

  if (!args.skipMatches) {
    // Flags: upsert detection fields only, so a reviewer's review_status is kept;
    // remove unreviewed flags that the latest detection no longer reports.
    for (let i = 0; i < matches.length; i += BATCH) {
      const { error } = await client.from('subaybayan_dpwh_matches').upsert(matches.slice(i, i + BATCH), { onConflict: 'subaybayan_id,dpwh_contract_id' });
      if (error) throw new Error(`Duplicate flag upsert failed: ${error.message}`);
    }
    const keep = new Set(matches.map((m) => `${m.subaybayan_id}|${m.dpwh_contract_id}`));
    const { data: current, error } = await client.from('subaybayan_dpwh_matches').select('subaybayan_id, dpwh_contract_id, review_status').eq('review_status', 'unreviewed');
    if (error) throw new Error(`Reading duplicate flags failed: ${error.message}`);
    const stale = (current ?? []).filter((m) => ids.has(m.subaybayan_id) && !keep.has(`${m.subaybayan_id}|${m.dpwh_contract_id}`));
    for (const s of stale) {
      await client.from('subaybayan_dpwh_matches').delete().eq('subaybayan_id', s.subaybayan_id).eq('dpwh_contract_id', s.dpwh_contract_id).eq('review_status', 'unreviewed');
    }
    console.log(`Duplicate flags: ${matches.length} upserted, ${stale.length} stale unreviewed removed.`);
  }

  const sizeAfter = await dbBytes(client);
  const dpwhAfter = await countRows(client, 'dpwh_contracts');
  const total = await countRows(client, 'subaybayan_projects');
  console.log(`Database size after: ${mb(sizeAfter)} (${sizeAfter >= sizeBefore ? '+' : ''}${mb(sizeAfter - sizeBefore)}).`);
  console.log(`subaybayan_projects: ${total?.toLocaleString('en-US')} rows. dpwh_contracts: ${dpwhAfter?.toLocaleString('en-US')} (${dpwhAfter === dpwhBefore ? 'unchanged' : 'CHANGED — investigate'}).`);
  if (dpwhAfter !== dpwhBefore) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
