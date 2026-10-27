'use client';

import React, { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCurrentProfile } from '@/lib/auth/CurrentProfileContext';
import { ADMIN_ROLES } from '@/types/auth';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast, type ToastTone } from '@/components/ui/Toast';
import { formatCount } from './format';

interface SyncResponse {
  status?: string;
  runId?: string | null;
  sourceRows?: number | null;
  nextRow?: number | null;
  totals?: { inserted: number; updated: number; unchanged: number; rejected: number };
  error?: string | null;
  continuing?: boolean;
}

const FAILED_MESSAGE = 'Sync failed. Existing records were not changed or deleted; the run log has the details.';

/**
 * Manual sync for administrators. Visibility uses the server-verified
 * profile; the endpoint re-checks the role, so hiding the button is a
 * convenience, not the access control.
 *
 * Starting a run asks first (it writes to the database and can take
 * minutes); continuing a paused run does not. The outcome is reported only
 * once the endpoint answers, as a toast and as the line beside the button.
 * Failure details stay in the run log and the browser console, not on screen.
 */
export function DpwhSyncButton() {
  const profile = useCurrentProfile();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  if (!profile || !ADMIN_ROLES.includes(profile.role)) return null;

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    let body: SyncResponse;
    try {
      const res = await fetch('/api/admin/dpwh-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runId ? { run: runId } : {}),
      });
      body = ((await res.json().catch(() => null)) as SyncResponse | null) ?? { status: 'failed' };
      if (res.status === 401 || res.status === 403) body = { status: 'failed', error: 'auth' };
      else if (!res.ok && !body.status) body = { ...body, status: 'failed' };
    } catch {
      body = { status: 'failed', error: 'network' };
    }
    if (body.status === 'failed' && body.error && body.error !== 'auth') console.warn('[LGU Tracker] DPWH sync failed:', body.error);
    setResult(body);
    setRunId(body.status === 'paused' && !body.continuing ? body.runId ?? null : null);
    setBusy(false);
    const outcome = describe(body);
    toast({ id: 'dpwh-sync', tone: outcome.tone, title: outcome.title, description: outcome.message });
  };

  const message = result ? describe(result).message : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
      <button
        type="button"
        onClick={() => (runId ? run() : setConfirming(true))}
        disabled={busy}
        aria-busy={busy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink text-on-ink font-medium hover:bg-ink-soft disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />}
        {busy ? 'Syncing…' : runId ? 'Continue sync' : 'Run DPWH sync now'}
      </button>
      {/* The toast announces the outcome; this line keeps it on screen without announcing it twice. */}
      {message && <span className="text-subtle">{message}</span>}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Start a DPWH sync?"
        description={
          <>
            This checks BetterGov.ph for a newer DPWH snapshot and imports changed contracts into the directory. It can take several
            minutes. Existing records are updated, never deleted.
          </>
        }
        confirmLabel="Start sync"
        onConfirm={() => {
          void run();
        }}
      />
    </div>
  );
}

function describe(result: SyncResponse): { tone: ToastTone; title: string; message: string } {
  const t = result.totals;
  const counts = t ? ` Inserted ${formatCount(t.inserted)}, updated ${formatCount(t.updated)}, unchanged ${formatCount(t.unchanged)}, rejected ${formatCount(t.rejected)}.` : '';
  switch (result.status) {
    case 'succeeded':
      return { tone: 'success', title: 'DPWH sync finished', message: `Sync finished.${counts}` };
    case 'no_new_snapshot':
      return { tone: 'info', title: 'Already up to date', message: 'No new source snapshot since the last successful sync. Data is unchanged.' };
    case 'paused':
      return result.continuing
        ? { tone: 'info', title: 'Sync continuing in the background', message: `Sync in progress (row ${formatCount(result.nextRow ?? 0)} of ${formatCount(result.sourceRows ?? 0)}); continuing in the background.${counts}` }
        : { tone: 'warning', title: 'Sync paused', message: `Paused at row ${formatCount(result.nextRow ?? 0)} of ${formatCount(result.sourceRows ?? 0)}. Select “Continue sync” to resume.${counts}` };
    case 'busy':
      return { tone: 'warning', title: 'A sync is already running', message: 'Another sync is already running. Try again when it finishes.' };
    default:
      return {
        tone: 'error',
        title: 'DPWH sync failed',
        message:
          result.error === 'network'
            ? 'Could not reach the server, so the sync may not have started. Existing records were not changed.'
            : result.error === 'auth'
              ? 'Your session has ended or your account cannot run syncs. Sign in again as an administrator.'
              : FAILED_MESSAGE,
      };
  }
}
