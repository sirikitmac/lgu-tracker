'use client';

import React, { useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useCurrentProfile } from '@/lib/auth/CurrentProfileContext';
import { ADMIN_ROLES } from '@/types/auth';
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

/**
 * Manual sync for administrators. Visibility uses the server-verified
 * profile; the endpoint re-checks the role, so hiding the button is a
 * convenience, not the access control.
 */
export function DpwhSyncButton() {
  const profile = useCurrentProfile();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  if (!profile || !ADMIN_ROLES.includes(profile.role)) return null;

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/dpwh-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runId ? { run: runId } : {}),
      });
      const body = (await res.json()) as SyncResponse;
      setResult(body);
      setRunId(body.status === 'paused' && !body.continuing ? body.runId ?? null : null);
    } catch (error) {
      setResult({ status: 'failed', error: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const message = (() => {
    if (!result) return null;
    const t = result.totals;
    const counts = t ? ` Inserted ${formatCount(t.inserted)}, updated ${formatCount(t.updated)}, unchanged ${formatCount(t.unchanged)}, rejected ${formatCount(t.rejected)}.` : '';
    switch (result.status) {
      case 'succeeded': return `Sync finished.${counts}`;
      case 'no_new_snapshot': return 'No new source snapshot since the last successful sync. Data is unchanged.';
      case 'paused': return result.continuing
        ? `Sync in progress (row ${formatCount(result.nextRow ?? 0)} of ${formatCount(result.sourceRows ?? 0)}); continuing in the background.${counts}`
        : `Paused at row ${formatCount(result.nextRow ?? 0)} of ${formatCount(result.sourceRows ?? 0)}. Click again to continue.${counts}`;
      case 'busy': return 'Another sync is already running.';
      default: return `Sync failed: ${result.error ?? 'unknown error'}. Existing records were not changed or deleted.`;
    }
  })();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink text-on-ink font-medium hover:bg-ink-soft disabled:opacity-60"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {runId ? 'Continue sync' : 'Run DPWH sync now'}
      </button>
      {message && <span role="status" className="text-subtle">{message}</span>}
    </div>
  );
}
