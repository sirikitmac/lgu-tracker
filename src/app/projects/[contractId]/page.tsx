import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, MapPin, MapPinOff } from 'lucide-react';
import { loadDpwhContractDetail } from '@/lib/integrations/dpwh/nationwide/detail';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DpwhContractDetails } from '@/components/dpwh/DpwhContractDetails';
import { STATUS_STYLES, contractMapHref, formatPeso, formatProgress, statusLabel } from '@/components/dpwh/format';

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
    <Link href="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline">
      <ArrowLeft className="w-4 h-4" /> Project directory
    </Link>
  );

  if (!result || result.status !== 'ok') {
    return (
      <>
        {back}
        <div role="alert" className="flex items-start gap-2 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
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
      <header className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-semibold text-[#172B4D]">{c.contract_id}</span>
          <span className={`px-2 py-0.5 rounded-full border ${STATUS_STYLES[c.status] ?? STATUS_STYLES.unknown}`}>{statusLabel(c.status)}</span>
        </div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-[#172B4D] leading-snug">{c.contract_name ?? c.title}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#64748B]">
          <span>{[c.province, c.region].filter(Boolean).join(', ') || 'Location not reported'}</span>
          <span>Contract amount <strong className="text-[#0F172A] tabular-nums">{formatPeso(c.contract_amount)}</strong></span>
          <span>Reported progress <strong className="text-[#0F172A] tabular-nums">{formatProgress(c.progress)}</strong></span>
        </div>
        {mapHref ? (
          <Link href={mapHref} className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline">
            <MapPin className="w-4 h-4" /> View on map
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-[#94A3B8]">
            <MapPinOff className="w-4 h-4" /> The source reports no coordinates for this contract.
          </span>
        )}
      </header>
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 shadow-2xs">
        <DpwhContractDetails detail={detail} />
      </div>
    </>
  );
}
