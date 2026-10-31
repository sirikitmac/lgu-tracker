/**
 * Read-only local snapshot of the DPWH contract fields used for duplicate
 * detection. Uses the public (publishable/anon) key: dpwh_contracts is public
 * read under RLS, so no secret is needed and nothing can be written.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const DPWH_MATCH_COLUMNS = [
  'contract_id', 'title', 'contract_name', 'region', 'province', 'provinces', 'municipality', 'barangay',
  'latitude', 'longitude', 'contract_amount', 'approved_budget', 'budget', 'infra_year', 'program_name',
  'source_category', 'source_of_funds', 'implementing_office', 'contractor', 'start_date', 'completion_date', 'status',
] as const;

export interface DpwhContract {
  contract_id: string;
  title: string | null;
  contract_name: string | null;
  region: string | null;
  province: string | null;
  provinces: string[] | null;
  municipality: string | null;
  barangay: string | null;
  latitude: number | null;
  longitude: number | null;
  contract_amount: number | null;
  approved_budget: number | null;
  budget: number | null;
  infra_year: number | null;
  program_name: string | null;
  source_category: string | null;
  source_of_funds: string | null;
  implementing_office: string | null;
  contractor: string | null;
  start_date: string | null;
  completion_date: string | null;
  status: string | null;
}

export async function loadDpwhSnapshot(cacheDir: string, refresh = false): Promise<{ rows: DpwhContract[]; fetchedAt: string }> {
  const file = path.join(cacheDir, 'dpwh-contracts-snapshot.json');
  if (!refresh && existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and the publishable/anon key are needed to read DPWH contracts.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows: DpwhContract[] = [];
  const page = 1000;
  let last = '';
  for (;;) {
    // Keyset pagination on the primary key: cheap under the anon statement timeout.
    let q = client.from('dpwh_contracts').select(DPWH_MATCH_COLUMNS.join(',')).order('contract_id').limit(page);
    if (last) q = q.gt('contract_id', last);
    const { data, error } = await q;
    if (error) throw new Error(`Reading dpwh_contracts failed: ${error.message}`);
    const batch = (data ?? []) as unknown as DpwhContract[];
    rows.push(...batch);
    process.stdout.write(`\r  DPWH contracts read: ${rows.length.toLocaleString('en-US')}`);
    if (batch.length < page) break;
    last = batch[batch.length - 1].contract_id;
  }
  process.stdout.write('\n');
  const snapshot = { rows, fetchedAt: new Date().toISOString() };
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(file, JSON.stringify(snapshot));
  return snapshot;
}
