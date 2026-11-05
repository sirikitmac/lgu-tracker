/**
 * Loads sample ("mock") reports so the inbox, My reports and the report queue
 * can be tried with real-looking data.
 *
 *   npm run reports:import -- path/to/reports.json            # dry run: check the file, no writes
 *   npm run reports:import -- path/to/reports.json --apply    # insert the reports
 *
 * The file format is described in docs/mock-reports.md (example:
 * docs/examples/mock-reports.example.json). Each report names an existing
 * project in the directory (source + record_id); its title and key fields are
 * copied from the database exactly as the app does when someone reports.
 *
 * --apply needs the service role: SUPABASE_SECRET_KEY (or the legacy
 * SUPABASE_SERVICE_ROLE_KEY) in the environment or .env.local. It is never
 * printed. Imported reports do not send notifications (the database only
 * notifies for changes made by a signed-in person).
 */
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { parseMockReports, type MockReport } from '@/lib/reports/import';
import { loadReportableRecord } from '@/lib/reports/record';
import { reportCategoryLabel } from '@/types/report';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function accountIds(client: SupabaseClient, wanted: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  const emails = new Set(wanted.filter((w) => !UUID.test(w)).map((w) => w.toLowerCase()));
  for (const id of wanted.filter((w) => UUID.test(w))) found.set(id, id);
  if (emails.size === 0) return found;
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email && emails.has(user.email.toLowerCase())) found.set(user.email.toLowerCase(), user.id);
    }
    if (data.users.length < 1000) break;
  }
  return found;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  for (const flag of args.filter((a) => a.startsWith('--'))) {
    if (flag !== '--apply') throw new Error(`Unknown option "${flag}".`);
  }
  if (!file) throw new Error('Give the path of a JSON file: npm run reports:import -- reports.json [--apply]');
  config({ path: '.env.local', quiet: true });

  const parsed = parseMockReports(JSON.parse(readFileSync(file, 'utf8')));
  if (!parsed.ok) {
    for (const message of parsed.errors) console.error(`  ${message}`);
    throw new Error(`${parsed.errors.length} problem(s) in ${file}. Nothing was imported.`);
  }
  const reports: MockReport[] = parsed.reports;
  console.log(`${reports.length} report(s) in ${file} look valid.`);

  const apply = args.includes('--apply');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secret = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secret) {
    if (apply) throw new Error('--apply needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
    console.log('Dry run only (no database settings found, so projects and accounts were not checked).');
    return;
  }
  const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const ids = await accountIds(client, reports.map((r) => r.submitter));
  const problems: string[] = [];
  const ready: Array<{ report: MockReport; userId: string; title: string; snapshot: Record<string, unknown> }> = [];

  for (const [i, report] of reports.entries()) {
    const userId = ids.get(report.submitter.toLowerCase()) ?? ids.get(report.submitter);
    if (!userId) {
      problems.push(`Report ${i + 1}: no account for "${report.submitter}". Sign up with it first.`);
      continue;
    }
    const record = await loadReportableRecord(client, report.source, report.recordId);
    if (!record) {
      problems.push(`Report ${i + 1}: no ${report.source} project with id "${report.recordId}".`);
      continue;
    }
    ready.push({ report, userId, title: record.title, snapshot: record.snapshot });
  }
  if (problems.length > 0) {
    for (const message of problems) console.error(`  ${message}`);
    throw new Error(`${problems.length} problem(s). Nothing was imported.`);
  }
  if (!apply) {
    console.log('Accounts and projects all exist. Run again with --apply to insert them.');
    return;
  }

  let inserted = 0;
  for (const { report, userId, title, snapshot } of ready) {
    const { data, error } = await client
      .from('reports')
      .insert({
        report_type: 'citizen_concern',
        report_category: report.category,
        title: `${reportCategoryLabel(report.category)}: ${title}`.slice(0, 300),
        body: report.details,
        record_source: report.source,
        record_id: report.recordId,
        record_title: title,
        record_snapshot: snapshot,
        observed_on: report.observedOn,
        location_note: report.locationNote,
        submitted_by: userId,
        ...(report.createdAt ? { created_at: report.createdAt } : {}),
      })
      .select('id')
      .single();
    if (error) throw new Error(`Insert failed after ${inserted} report(s): ${error.message}`);

    if (report.status !== 'submitted') {
      const { error: updateError } = await client
        .from('reports')
        .update({ status: report.status, ...(report.note ? { resolution_notes: report.note } : {}) })
        .eq('id', data.id);
      if (updateError) throw new Error(`Status update failed after ${inserted} report(s): ${updateError.message}`);
    }
    inserted += 1;
  }
  console.log(`Imported ${inserted} report(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
