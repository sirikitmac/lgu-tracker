'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MapPin, X } from 'lucide-react';
import type { DpwhContractDetail } from '@/lib/integrations/dpwh/nationwide/detail';
import { errorMessage, fetchJson } from '@/lib/http';
import { ErrorState, Skeleton } from '@/components/ui/StateViews';
import { DpwhContractDetails } from './DpwhContractDetails';
import { contractMapHref } from './format';

/** The detail layout's shape (notice, then labelled sections) while the record loads. */
function DetailsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <Skeleton className="h-14 !rounded-card" />
      {[5, 4, 3].map((rows, s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className={`h-3.5 ${i % 2 ? 'w-2/3' : 'w-5/6'}`} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DpwhContractDrawer({ contractId, onClose }: { contractId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<DpwhContractDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!contractId) return;
    const controller = new AbortController();
    setDetail(null);
    setError(null);
    fetchJson<DpwhContractDetail>(`/api/dpwh/contracts/${encodeURIComponent(contractId)}`, { signal: controller.signal })
      .then(setDetail)
      .catch((e: unknown) => (e as Error)?.name !== 'AbortError' && setError(errorMessage(e, 'Could not load this contract.')));
    return () => controller.abort();
  }, [contractId, reload]);

  // Callers pass an inline onClose; a ref keeps the effect below from re-running (and refocusing) on each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Move focus into the panel when it opens and give it back to the opener when it closes.
  const open = contractId !== null;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  if (!contractId) return null;
  const c = detail?.contract;
  const mapHref = c ? contractMapHref(c) : null;

  return (
    <div className="fixed inset-0 z-[1000] flex justify-end" role="dialog" aria-modal="true" aria-label={`DPWH contract ${contractId}`}>
      <button type="button" tabIndex={-1} aria-label="Close details" className="absolute inset-0 bg-ink/35 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative w-full max-w-2xl h-full overflow-y-auto bg-surface shadow-float motion-safe:animate-[drawer-in_260ms_var(--ease-out)]">
        <header className="sticky top-0 z-10 glass-strong border-b border-line/80 px-5 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">DPWH contract {contractId}</p>
            {c ? (
              <h2 className="text-lg font-semibold tracking-tight text-ink leading-snug">{c.contract_name ?? c.title}</h2>
            ) : error ? (
              <h2 className="text-lg font-semibold tracking-tight text-ink leading-snug">Contract details</h2>
            ) : (
              <>
                <h2 className="sr-only">Loading contract</h2>
                <Skeleton className="mt-1.5 h-5 w-4/5" />
                <Skeleton className="mt-2 h-5 w-1/2" />
              </>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs font-medium">
              <Link href={`/projects/${encodeURIComponent(contractId)}`} className="inline-flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                Open full page <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
              </Link>
              {mapHref && (
                <Link href={mapHref} className="inline-flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                  <MapPin className="w-3 h-3" aria-hidden="true" /> View on map
                </Link>
              )}
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="p-2 rounded-full hover:bg-sunken focus-visible:outline-2 focus-visible:outline-accent-ink" aria-label="Close">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </header>

        <div className="px-5 py-5 space-y-6" aria-busy={!detail && !error}>
          {error ? (
            <ErrorState compact title="Contract details could not be loaded" description={error} onRetry={() => setReload((n) => n + 1)} />
          ) : detail ? (
            <DpwhContractDetails detail={detail} />
          ) : (
            <DetailsSkeleton />
          )}
        </div>
      </aside>
    </div>
  );
}
