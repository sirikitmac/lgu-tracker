import type { NextRequest } from 'next/server';
import { AuthorizationError, requireRole } from '@/lib/auth/authorize';
import { continueAfterResponse, outcomeBody, runSyncInvocation } from '@/lib/integrations/dpwh/nationwide/runner';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UUID_PATTERN } from '@/lib/actions/shared';
import { ADMIN_ROLES } from '@/types/auth';

/**
 * POST /api/admin/dpwh-sync   body: { "force"?: boolean, "run"?: "<id to resume>" }
 *
 * Manual nationwide sync for super_admin / lgu_admin. Runs as the signed-in
 * administrator (the database re-checks the role), so no service-role key
 * is involved. A paused run is chained through the cron route when
 * CRON_SECRET is configured; otherwise POST again with the returned run id.
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    await requireRole(...ADMIN_ROLES);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      const status = { NOT_CONFIGURED: 503, UNAUTHENTICATED: 401, FORBIDDEN: 403 }[error.code];
      return Response.json({ error: error.message }, { status });
    }
    throw error;
  }

  const body = (await request.json().catch(() => ({}))) as { force?: unknown; run?: unknown };
  if (body.force !== undefined && typeof body.force !== 'boolean') {
    return Response.json({ error: 'force must be a boolean.' }, { status: 400 });
  }
  if (body.run !== undefined && (typeof body.run !== 'string' || !UUID_PATTERN.test(body.run))) {
    return Response.json({ error: 'run must be a sync run id.' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const outcome = await runSyncInvocation(supabase!, 'manual', {
    force: body.force === true,
    resumeRunId: (body.run as string | undefined) ?? null,
  });
  const chained = continueAfterResponse(request.nextUrl.origin, outcome, 0);
  const status = outcome.status === 'failed' ? 502 : outcome.status === 'busy' ? 409 : 200;
  return Response.json(outcomeBody(outcome, chained), { status, headers: { 'Cache-Control': 'no-store' } });
}
