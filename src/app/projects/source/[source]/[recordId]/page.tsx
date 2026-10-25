import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ExternalLink, MapPinOff } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hubFileUrl } from '@/lib/integrations/bettergov/hub';
import { PROJECT_SOURCES, isProjectSource } from '@/lib/integrations/bettergov/sources';
import { statusBadgeClass, categoryLabel, formatDate, formatPeso, statusLabel, warningLabel } from '@/components/dpwh/format';
import type { InfrastructureProject } from '@/types/infrastructureProject';

const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;

export async function generateMetadata({ params }: PageProps<'/projects/source/[source]/[recordId]'>): Promise<Metadata> {
  const { source, recordId } = await params;
  return { title: `${isProjectSource(source) ? PROJECT_SOURCES[source].label : 'Project'} ${recordId} · LGU Tracker` };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[#64748B]">{label}</dt>
      <dd className="text-sm text-[#0F172A] mt-0.5 break-words">{children ?? 'Not reported'}</dd>
    </div>
  );
}

/** Public detail page for a record from a non-contract BetterGov.ph source. */
export default async function SourceProjectPage({ params }: PageProps<'/projects/source/[source]/[recordId]'>) {
  const { source, recordId } = await params;
  if (!isProjectSource(source) || source === 'dpwh_contracts' || !RECORD_ID.test(recordId)) notFound();

  const back = (
    <Link href="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline">
      <ArrowLeft className="w-4 h-4" /> Project directory
    </Link>
  );
  const supabase = await createSupabaseServerClient();
  const { data, error } = supabase
    ? await supabase.from('infrastructure_projects').select('*').eq('source', source).eq('source_id', recordId).maybeSingle()
    : { data: null, error: { message: 'not configured' } };
  if (!error && !data) notFound();
  if (error) {
    console.error('[LGU Tracker] Source project query failed:', error);
    return (
      <>
        {back}
        <div role="alert" className="flex items-start gap-2 p-4 rounded-lg border border-red-200 bg-red-50 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {supabase ? 'Could not load this project. Please try again later.' : 'The project database is not configured.'}
        </div>
      </>
    );
  }

  const p = data as InfrastructureProject;
  const info = PROJECT_SOURCES[source];
  const original = Object.entries(p.source_record);

  return (
    <>
      {back}
      <header className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-semibold text-[#172B4D]">{p.source_id}</span>
          <span className={`px-2 py-0.5 rounded-full border ${statusBadgeClass(p.status)}`}>{statusLabel(p.status)}</span>
          <span className="px-2 py-0.5 rounded border border-[#E2E8F0] bg-[#F8FAFC] font-medium text-[#475569]">Source: {info.label}</span>
        </div>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-[#172B4D] leading-snug">{p.title}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#64748B]">
          <span>{[p.municipality, p.province, p.region].filter(Boolean).join(', ') || 'Location not reported'}</span>
          <span>{p.amount_label} <strong className="text-[#0F172A] tabular-nums">{formatPeso(p.amount)}</strong></span>
          {p.fiscal_year && <span>Fiscal year <strong className="text-[#0F172A]">{p.fiscal_year}</strong></span>}
        </div>
        {p.status === 'proposed' && (
          <p className="text-xs text-[#5B21B6] bg-violet-50 border border-violet-200 rounded-lg p-3 leading-relaxed">
            <strong>Proposed (budget)</strong> means this project is listed in the FY 2027 National Expenditure Program,
            the budget the executive proposes to Congress. It is not an approved appropriation, a funded project, or an
            awarded contract. The source has no status column: LGU Tracker gives every record in this dataset this status.
          </p>
        )}
        {p.latitude === null && (
          <span className="inline-flex items-center gap-1 text-sm text-[#94A3B8]">
            <MapPinOff className="w-4 h-4" /> The source reports no coordinates for this project, so it is not on the map.
          </span>
        )}
      </header>

      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6 shadow-2xs space-y-6">
        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-[#172B4D]">Project</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Implementing office">{p.implementing_office}</Field>
            <Field label="Category">{categoryLabel(p.category)} <span className="block text-xs text-[#64748B]">Classified from {p.category_reason}</span></Field>
            <Field label="Program">{p.program_name}</Field>
            <Field label="Sub-program">{p.sub_program}</Field>
            <Field label="Project type">{p.project_type}</Field>
            <Field label="Region (as reported)">{p.region}</Field>
          </dl>
          {p.data_warnings.length > 0 && (
            <ul className="text-xs text-[#92400E] bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              {p.data_warnings.map((w) => <li key={w}>{warningLabel(w)}</li>)}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-[#172B4D]">Original source record</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {original.map(([key, value]) => (
              <div key={key} className="text-xs">
                <dt className="font-mono text-[#64748B]">{key}</dt>
                <dd className="text-[#0F172A] break-words">{value === null || value === '' ? '—' : String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-2 text-xs text-[#64748B]">
          <h2 className="font-display text-base font-semibold text-[#172B4D]">Provenance</h2>
          <p>{info.description}. License: {info.license}. Values are as published and have not been verified by the LGU.</p>
          <p>
            Snapshot {p.source_revision.slice(0, 10)} committed {formatDate(p.source_snapshot_at)}; last imported {formatDate(p.updated_at)}.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href={info.datasetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#2563EB] hover:underline">
              Dataset <ExternalLink className="w-3 h-3" />
            </a>
            <a href={hubFileUrl(p.source_dataset, p.source_file, p.source_revision)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-[#2563EB] hover:underline">
              Source file at this snapshot <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
