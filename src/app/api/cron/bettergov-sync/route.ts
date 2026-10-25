import { isAuthorizedCron } from '@/lib/integrations/dpwh/nationwide/runner';
import { nepAdapter } from '@/lib/integrations/bettergov/nep/source';
import { supabaseSourceStore } from '@/lib/integrations/bettergov/store';
import { runSourceSync } from '@/lib/integrations/bettergov/sync';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/cron/bettergov-sync
 *
 * Weekly import of the smaller BetterGov.ph datasets (DPWH FY 2027 NEP
 * projects), scheduled by vercel.json 30 minutes after the DPWH contract
 * sync. Same CRON_SECRET check. A snapshot that already succeeded is logged
 * as no_new_snapshot and not re-applied.
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get('authorization'))) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const client = createSupabaseAdminClient();
  if (!client) {
    return Response.json({ error: 'SUPABASE_SECRET_KEY is not configured on the server.' }, { status: 503 });
  }

  const outcome = await runSourceSync({
    store: supabaseSourceStore(client),
    adapter: nepAdapter,
    trigger: 'cron',
    log: (message) => console.log(`[BetterGov sync] ${message}`),
  });
  return Response.json(outcome, { status: outcome.status === 'failed' ? 502 : 200, headers: { 'Cache-Control': 'no-store' } });
}
