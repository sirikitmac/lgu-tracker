'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, Loader2, MapPin, X } from 'lucide-react';
import type { DpwhContractDetail } from '@/lib/integrations/dpwh/nationwide/detail';
import { DpwhContractDetails } from './DpwhContractDetails';
import { contractMapHref } from './format';

export function DpwhContractDrawer({ contractId, onClose }: { contractId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<DpwhContractDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractId) return;
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    fetch(`/api/dpwh/contracts/${encodeURIComponent(contractId)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setDetail(body);
      })
      .catch((e: Error) => e.name !== 'AbortError' && setError(e.message));
    return () => controller.abort();
  }, [contractId]);

  useEffect(() => {
    if (!contractId) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contractId, onClose]);

  if (!contractId) return null;
  const c = detail?.contract;
  const mapHref = c ? contractMapHref(c) : null;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end" role="dialog" aria-modal="true" aria-label={`DPWH contract ${contractId}`}>
      <button type="button" aria-label="Close details" className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-2xl h-full overflow-y-auto bg-surface shadow-float motion-safe:animate-[drawer-in_260ms_var(--ease-out)]">
        <header className="sticky top-0 z-10 glass-strong border-b border-line/80 px-5 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted">DPWH contract {contractId}</p>
            <h2 className="text-lg font-semibold tracking-tight text-ink leading-snug">{c ? c.contract_name ?? c.title : 'Loading…'}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs font-medium">
              <Link href={`/projects/${encodeURIComponent(contractId)}`} className="inline-flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                Open full page <ArrowUpRight className="w-3 h-3" />
              </Link>
              {mapHref && (
                <Link href={mapHref} className="inline-flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                  <MapPin className="w-3 h-3" /> View on map
                </Link>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent-ink" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="px-5 py-5 space-y-6">
          {!detail && !error && (
            <div className="flex items-center gap-2 text-sm text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Loading contract…</div>
          )}
          {error && (
            <div role="alert" className="flex items-start gap-2 p-3 rounded-lg border border-danger-line bg-danger-soft text-sm text-danger-ink">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {detail && <DpwhContractDetails detail={detail} />}
        </div>
      </aside>
    </div>
  );
}
