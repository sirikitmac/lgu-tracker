import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ExternalLink, MapPinOff } from 'lucide-react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { hubFileUrl } from '@/lib/integrations/bettergov/hub';
import { PROJECT_SOURCES, isProjectSource } from '@/lib/integrations/bettergov/sources';
import { categoryLabel, formatDate, formatPeso, warningLabel } from '@/components/dpwh/format';
import { StatusPill } from '@/components/dpwh/StatusPill';
import type { InfrastructureProject } from '@/types/infrastructureProject';

const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;

export async function generateMetadata({ params }: PageProps<'/projects/source/[source]/[recordId]'>): Promise<Metadata> {
  const { source, recordId } = await params;
  return { title: `${isProjectSource(source) ? PROJECT_SOURCES[source].label : 'Project'} ${recordId} · LGU Tracker` };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-sm text-ink mt-0.5 break-words">{children ?? 'Not reported'}</dd>
    </div>
  );
}

/** Public detail page for a record from a non-contract BetterGov.ph source. */
export default async function SourceProjectPage({ params }: PageProps<'/projects/source/[source]/[recordId]'>) {
  const { source, recordId } = await params;
  if (!isProjectSource(source) || source === 'dpwh_contracts' || !RECORD_ID.test(recordId)) notFound();

  const back = (
    <Link href="/projects" className="inline-flex items-center gap-1 text-sm font-medium text-subtle hover:text-ink rounded-sm focus-visible:outline-2 focus-visible:outline-accent-ink">
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
        <div role="alert" className="flex items-start gap-2 p-4 rounded-card border border-red-200 bg-red-50 text-sm text-red-800">
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
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold tabular-nums text-subtle">{p.source_id}</span>
          <StatusPill status={p.status} />
          <span className="inline-flex items-center h-6 px-2 rounded-full bg-sunken font-medium text-subtle">Source: {info.label}</span>
        </div>
        <h1 className="max-w-4xl text-xl sm:text-[26px] font-semibold tracking-tight text-ink leading-[1.2]">{p.title}</h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
          <span>{[p.municipality, p.province, p.region].filter(Boolean).join(', ') || 'Location not reported'}</span>
          <span>{p.amount_label} <strong className="text-ink tabular-nums">{formatPeso(p.amount)}</strong></span>
          {p.fiscal_year && <span>Fiscal year <strong className="text-ink">{p.fiscal_year}</strong></span>}
        </div>
        {p.status === 'proposed' && (
          <p className="text-xs text-[#5B21B6] bg-violet-50 border border-violet-200 rounded-card px-4 py-3 leading-relaxed">
            <strong>Proposed (budget)</strong> means this project is listed in the FY 2027 National Expenditure Program,
            the budget the executive proposes to Congress. It is not an approved appropriation, a funded project, or an
            awarded contract. The source has no status column: LGU Tracker gives every record in this dataset this status.
          </p>
        )}
        {p.latitude === null && (
          <span className="inline-flex items-center gap-1 text-sm text-muted">
            <MapPinOff className="w-4 h-4" /> The source reports no coordinates for this project, so it is not on the map.
          </span>
        )}
      </header>

      <div className="bg-surface border border-line rounded-card p-5 sm:p-8 space-y-8">
        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight text-ink">Project</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Implementing office">{p.implementing_office}</Field>
            <Field label="Category">{categoryLabel(p.category)} <span className="block text-xs text-muted">Classified from {p.category_reason}</span></Field>
            <Field label="Program">{p.program_name}</Field>
            <Field label="Sub-program">{p.sub_program}</Field>
            <Field label="Project type">{p.project_type}</Field>
            <Field label="Region (as reported)">{p.region}</Field>
          </dl>
          {p.data_warnings.length > 0 && (
            <ul className="text-xs text-[#92400E] bg-amber-50 border border-amber-200 rounded-card px-4 py-3 space-y-1">
              {p.data_warnings.map((w) => <li key={w}>{warningLabel(w)}</li>)}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight text-ink">Original source record</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            {original.map(([key, value]) => (
              <div key={key} className="text-xs">
                <dt className="font-mono text-muted">{key}</dt>
                <dd className="text-ink break-words">{value === null || value === '' ? '—' : String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-2 text-xs text-muted">
          <h2 className="text-base font-semibold tracking-tight text-ink">Provenance</h2>
          <p>{info.description}. License: {info.license}. Values are as published and have not been verified by the LGU.</p>
          <p>
            Snapshot {p.source_revision.slice(0, 10)} committed {formatDate(p.source_snapshot_at)}; last imported {formatDate(p.updated_at)}.
          </p>
          <div className="flex flex-wrap gap-4">
            <a href={info.datasetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
              Dataset <ExternalLink className="w-3 h-3" />
            </a>
            <a href={hubFileUrl(p.source_dataset, p.source_file, p.source_revision)} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent-ink hover:underline">
              Source file at this snapshot <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
