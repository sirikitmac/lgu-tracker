/**
 * Opt-in full-scale check: imports the entire pinned nationwide snapshot into
 * a local on-disk PGlite database through the real sync engine and SQL, then
 * (in a separate process, to stay within WASM memory) re-runs it to prove
 * idempotency. Reports storage size. Never touches the hosted database.
 *
 *   npm run test:db:full -- <empty scratch directory>          # first import
 *   npm run test:db:full -- <same directory> --rerun           # forced re-run
 */
import { existsSync, readdirSync } from 'node:fs';
import { DPWH_REVIEWED_SNAPSHOT } from '@/lib/integrations/dpwh/nationwide/source';
import { runDpwhSync } from '@/lib/integrations/dpwh/nationwide/sync';
import { USERS, createTestDb, openTestDb, pgliteStore } from './pglite';

async function main() {
  const [dir, mode] = process.argv.slice(2);
  if (!dir) throw new Error('Pass a directory for the local database.');
  const rerun = mode === '--rerun';
  if (!rerun && existsSync(dir) && readdirSync(dir).length > 0) throw new Error('Pass an empty directory for the first import.');
  const db = rerun ? await openTestDb(dir) : await createTestDb(dir);
  const store = pgliteStore(db, 'authenticated', USERS.admin);
  const started = Date.now();
  const outcome = await runDpwhSync({
    store, trigger: 'cli', deadline: Infinity, snapshot: DPWH_REVIEWED_SNAPSHOT, force: rerun,
    log: rerun ? () => {} : (m) => console.log(m),
  });
  console.log(rerun ? 'FORCED RE-RUN' : 'FIRST RUN', JSON.stringify({
    status: outcome.status, totals: outcome.totals, error: outcome.error ?? null, secs: (Date.now() - started) / 1000,
  }));
  if (rerun) {
    const unforced = await runDpwhSync({ store, trigger: 'cli', deadline: Infinity, snapshot: DPWH_REVIEWED_SNAPSHOT, log: () => {} });
    console.log('UNFORCED RE-RUN', unforced.status);
  }

  const size = await db.query(`select round(pg_total_relation_size('public.dpwh_contracts') / 1e6)::int total_mb,
      round(pg_relation_size('public.dpwh_contracts') / 1e6)::int heap_mb,
      round(pg_indexes_size('public.dpwh_contracts') / 1e6)::int index_mb,
      round(pg_database_size(current_database()) / 1e6)::int database_mb`);
  console.log('SIZE (MB)', JSON.stringify(size.rows[0]));
  const facts = await db.query(`select count(*)::int total, count(distinct contract_id)::int ids,
      count(region)::int with_region, count(province)::int with_province, count(municipality)::int with_municipality,
      count(contract_amount)::int with_amount, count(contract_name)::int distinct_contract_name from public.dpwh_contracts`);
  console.log('CONTENT', JSON.stringify(facts.rows[0]));
  const runs = await db.query(`select trigger, status, inserted_count, updated_count, unchanged_count, rejected_count, error
      from public.dpwh_sync_runs order by started_at`);
  console.log('RUNS', JSON.stringify(runs.rows));
  await db.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
