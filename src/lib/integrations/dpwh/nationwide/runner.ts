import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseSyncStore } from './store';
import { runDpwhSync, type SyncOutcome, type SyncTrigger } from './sync';

/**
 * Shared glue for the scheduled and manual sync routes: secret checking,
 * the per-invocation time budget, and chaining the next invocation when a
 * run pauses. Chaining is best effort; a run that is not continued is
 * resumed by the next scheduled or manual sync (or the CLI).
 */

/** Leave headroom under the route's maxDuration (300 s). */
export const INVOCATION_BUDGET_MS = 240_000;
/** Safety cap on chained invocations for one run. */
export const MAX_HOPS = 40;

export function cronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

/** Constant-time check of "Authorization: Bearer <CRON_SECRET>". */
export function isAuthorizedCron(authorization: string | null): boolean {
  const secret = cronSecret();
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(authorization);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function runSyncInvocation(
  client: SupabaseClient,
  trigger: SyncTrigger,
  options: { resumeRunId?: string | null; force?: boolean } = {}
): Promise<SyncOutcome> {
  return runDpwhSync({
    store: supabaseSyncStore(client),
    trigger,
    deadline: Date.now() + INVOCATION_BUDGET_MS,
    resumeRunId: options.resumeRunId ?? null,
    force: options.force ?? false,
    log: (message) => console.log(`[DPWH sync] ${message}`),
  });
}

/** After the response is sent, ask the cron route to continue a paused run. */
export function continueAfterResponse(origin: string, outcome: SyncOutcome, hop: number): boolean {
  const secret = cronSecret();
  if (outcome.status !== 'paused' || !outcome.runId || !secret || hop >= MAX_HOPS) return false;
  const url = new URL('/api/cron/dpwh-sync', origin);
  url.searchParams.set('run', outcome.runId);
  url.searchParams.set('hop', String(hop + 1));
  after(async () => {
    try {
      // Only wait for the next invocation to be accepted, not to finish.
      await Promise.race([
        fetch(url, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' }),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
    } catch (error) {
      console.error('[DPWH sync] Could not chain the next invocation:', error);
    }
  });
  return true;
}

/** Response body without anything sensitive. */
export function outcomeBody(outcome: SyncOutcome, chained: boolean) {
  return {
    status: outcome.status,
    runId: outcome.runId,
    snapshot: outcome.snapshot && { revision: outcome.snapshot.revision, committedAt: outcome.snapshot.committedAt },
    sourceRows: outcome.sourceRows,
    nextRow: outcome.nextRow,
    totals: outcome.totals,
    error: outcome.error ?? null,
    continuing: chained,
  };
}
