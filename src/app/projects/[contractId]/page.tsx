import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, MapPin, MapPinOff } from 'lucide-react';
import { loadDpwhContractDetail } from '@/lib/integrations/dpwh/nationwide/detail';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DpwhContractDetails } from '@/components/dpwh/DpwhContractDetails';
import { contractMapHref, formatPeso, formatProgress } from '@/components/dpwh/format';
import { StatusPill } from '@/components/dpwh/StatusPill';
import { ProgressBar } from '@/components/dpwh/DpwhProjectCard';

export async function generateMetadata({ params }: PageProps<'/projects/[contractId]'>): Promise<Metadata> {
  const { contractId } = await params;
  return { title: `DPWH contract ${contractId} · LGU Tracker` };
}

export default async function PublicContractPage({ params }: PageProps<'/projects/[contractId]'>) {
  const { contractId } = await params;
  const supabase = await createSupabaseServerClient();
  const result = supabase ? await loadDpwhContractDetail(supabase, contractId) : null;

  if (result?.status === 'invalid' || result?.status === 'not_found') notFound();

  const back = (
    <Link href="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-subtle hover:text-ink rounded-sm focus-visible:outline-2 focus-visible:outline-accent-ink">
      <ArrowLeft className="w-4 h-4" /> Project directory
    </Link>
  );

  if (!result || result.status !== 'ok') {
    return (
      <>
        {back}
        <div role="alert" className="flex items-start gap-2 p-4 rounded-card border border-danger-line bg-danger-soft text-sm text-danger-ink">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {result ? 'Could not load this contract. Please try again later.' : 'The project database is not configured.'}
        </div>
      </>
    );
  }

  const { detail } = result;
  const c = detail.contract;
  const mapHref = contractMapHref(c);

  return (
    <>
      {back}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold tabular-nums text-subtle">DPWH contract {c.contract_id}</span>
          <StatusPill status={c.status} />
        </div>
        <h1 className="max-w-4xl text-xl sm:text-[26px] font-semibold tracking-tight text-ink leading-[1.2]">{c.contract_name ?? c.title}</h1>
        <dl className="grid grid-cols-1 sm:grid-cols-3 bg-surface border border-line rounded-card divide-y sm:divide-y-0 sm:divide-x divide-line">
          <div className="p-4 sm:p-5">
            <dt className="text-xs font-medium text-muted">Contract amount (reported)</dt>
            <dd className="mt-2 font-semibold text-[32px] leading-none tracking-tight text-ink">{formatPeso(c.contract_amount)}</dd>
          </div>
          <div className="p-4 sm:p-5">
            <dt className="text-xs font-medium text-muted">Reported progress</dt>
            <dd className="mt-2 font-semibold text-[32px] leading-none tracking-tight text-ink">{formatProgress(c.progress)}</dd>
            {c.progress !== null && <ProgressBar value={Number(c.progress)} className="mt-3 max-w-[12rem]" />}
          </div>
          <div className="p-4 sm:p-5">
            <dt className="text-xs font-medium text-muted">Reported location</dt>
            <dd className="mt-2 text-base font-semibold text-ink">{[c.province, c.region].filter(Boolean).join(', ') || 'Location not reported'}</dd>
            <dd className="mt-2 text-sm">
              {mapHref ? (
                <Link href={mapHref} className="inline-flex items-center gap-1 font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                  <MapPin className="w-4 h-4" aria-hidden="true" /> View on map
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 text-muted">
                  <MapPinOff className="w-4 h-4" aria-hidden="true" /> The source reports no coordinates for this contract.
                </span>
              )}
            </dd>
          </div>
        </dl>
      </header>
      <div className="bg-surface border border-line rounded-card p-5 sm:p-8">
        <DpwhContractDetails detail={detail} />
      </div>
    </>
  );
}
