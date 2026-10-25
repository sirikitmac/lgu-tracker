import type { NextRequest } from 'next/server';
import {
  continueAfterResponse,
  isAuthorizedCron,
  outcomeBody,
  runSyncInvocation,
} from '@/lib/integrations/dpwh/nationwide/runner';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { UUID_PATTERN } from '@/lib/actions/shared';

/**
 * GET /api/cron/dpwh-sync[?run=<id>&hop=<n>]
 *
 * Weekly nationwide DPWH sync, scheduled by vercel.json for Monday 02:00
 * Philippine time (Sunday 18:00 UTC). Vercel Cron sends
 * "Authorization: Bearer $CRON_SECRET"; every other caller is refused.
 * Long runs pause within the time budget and chain to themselves.
 */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request.headers.get('authorization'))) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const client = createSupabaseAdminClient();
  if (!client) {
    return Response.json({ error: 'SUPABASE_SECRET_KEY is not configured on the server.' }, { status: 503 });
  }

  const params = request.nextUrl.searchParams;
  const run = params.get('run');
  if (run !== null && !UUID_PATTERN.test(run)) return Response.json({ error: 'Invalid run id.' }, { status: 400 });
  const hop = Number(params.get('hop') ?? 0);
  if (!Number.isInteger(hop) || hop < 0) return Response.json({ error: 'Invalid hop.' }, { status: 400 });

  const outcome = await runSyncInvocation(client, 'cron', { resumeRunId: run });
  const chained = continueAfterResponse(request.nextUrl.origin, outcome, hop);
  const status = outcome.status === 'failed' ? 502 : outcome.status === 'busy' ? 409 : 200;
  return Response.json(outcomeBody(outcome, chained), { status, headers: { 'Cache-Control': 'no-store' } });
}
