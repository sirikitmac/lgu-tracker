import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, MapPin, MapPinOff } from 'lucide-react';
import { projectMapLink } from '@/lib/subaybayan/code';
import { SUBAYBAYAN_CATEGORY_COLORS, SUBAYBAYAN_CATEGORY_LABELS, SUBAYBAYAN_STATUS_LABELS } from '@/lib/subaybayan/categories';
import type { SubaybayanDetail } from '@/lib/subaybayan/query';
import { SUBAYBAYAN_DATASET_INFO, SUBAYBAYAN_RETRIEVED_LABEL } from '@/lib/subaybayan/source';
import {
  directoryProvinceLabel,
  directoryRegionLabel,
  implementingLgu,
  placeLine,
  precisionLabel,
  precisionNote,
  subaybayanStatusBadge,
  subaybayanStatusFill,
} from '@/lib/subaybayan/ui';
import { formatCount, formatDate, formatPeso, readableTitle } from '@/components/dpwh/format';
import { CostNote, ReviewNote } from './CostNotes';

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-sm text-ink mt-0.5 break-words">{children ?? <span className="text-muted">Not reported</span>}</dd>
    </div>
  );
}

const sectionTitle = 'text-base font-semibold tracking-tight text-ink';

/**
 * Public page for one DILG SubayBAYAN project (/projects/source/subaybayan_*),
 * with everything the map's detail panel shows: costs and their notes,
 * status, OWPA, contractor, dates, location precision, the classification
 * note, and the source with its retrieval date.
 */
export function DilgProjectDetail({ p }: { p: SubaybayanDetail }) {
  const info = SUBAYBAYAN_DATASET_INFO[p.source_dataset];
  const owpa = p.owpa === null ? null : Math.min(100, Math.max(0, p.owpa));
  const lgu = implementingLgu({
    project_owner: p.project_owner,
    province: directoryProvinceLabel(p.province),
    municipality: p.citymun,
    barangay: p.barangay,
  });
  const region = directoryRegionLabel(p.region);

  return (
    <>
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold tabular-nums text-subtle">{p.project_code ?? 'No project code (not yet enrolled)'}</span>
          <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border font-medium ${subaybayanStatusBadge(p.status)}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subaybayanStatusFill(p.status) }} aria-hidden="true" />
            {SUBAYBAYAN_STATUS_LABELS[p.status]}
          </span>
          <span className="inline-flex items-center h-6 px-2 rounded-full bg-sunken font-semibold text-ink">DILG SubayBAYAN</span>
          <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-sunken font-medium text-ink">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SUBAYBAYAN_CATEGORY_COLORS[p.sector_category] }} aria-hidden="true" />
            {SUBAYBAYAN_CATEGORY_LABELS[p.sector_category]}
            {p.sector_subcategory && p.sector_subcategory !== 'Uncategorized' && <span className="font-normal text-subtle">· {p.sector_subcategory}</span>}
          </span>
        </div>
        <h1 className="max-w-4xl text-xl sm:text-[26px] font-semibold tracking-tight text-ink leading-[1.2] text-pretty break-words" title={p.title}>
          {readableTitle(p.title)}
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
          <span>{placeLine(p)}{region ? `, ${region}` : ''}</span>
          <span>
            Total project cost <strong className="text-ink tabular-nums">{formatPeso(p.total_cost)}</strong>
            {p.total_cost_review && <span className="ml-1.5 font-medium text-warn-ink">· Amount not verified</span>}
          </span>
          {p.funding_year && <span>Funding year <strong className="text-ink">{p.funding_year}</strong></span>}
        </div>
        <p className="text-xs text-muted">
          Category: LGU Tracker classification ({p.classification_reason}), not an official DILG category.
        </p>
      </header>

      <div className="bg-surface border border-line rounded-card p-5 sm:p-8 space-y-8">
        <section className="space-y-3" aria-labelledby="dilg-location">
          <h2 id="dilg-location" className={sectionTitle}>Location</h2>
          <div className="rounded-xl bg-sunken px-4 py-3 text-sm leading-snug">
            <p className="flex items-start gap-1.5 font-medium text-ink">
              {p.latitude === null ? <MapPinOff className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /> : <MapPin className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />}
              <span>{placeLine(p)}{p.region ? <span className="text-subtle"> · {p.region}</span> : null}</span>
            </p>
            <p className="mt-1.5 text-[13px] text-subtle">
              <span className="font-semibold">Location precision: {precisionLabel(p.location_precision)}.</span> {precisionNote(p.location_precision)}
            </p>
            {p.latitude === null && <p className="mt-1.5 text-[13px] font-medium text-warn-ink">This project has no mappable location in the source.</p>}
            <Link href={projectMapLink(p)} className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-ink hover:underline rounded-sm focus-visible:outline-2 focus-visible:outline-accent-ink">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> View on map
            </Link>
          </div>
        </section>

        <section className="space-y-3" aria-labelledby="dilg-costs">
          <h2 id="dilg-costs" className={sectionTitle}>Costs</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Total project cost">
              {p.total_cost === null ? null : (
                <>
                  <span className="font-semibold tabular-nums">{formatPeso(p.total_cost)}</span>
                  {p.total_cost_reported !== null && p.total_cost_basis && <CostNote reported={p.total_cost_reported} basis={p.total_cost_basis} />}
                  {p.total_cost_review && <ReviewNote />}
                </>
              )}
            </Field>
            <Field label="National subsidy">{p.national_subsidy === null ? null : <span className="tabular-nums">{formatPeso(p.national_subsidy)}</span>}</Field>
            <Field label="LGU counterpart">{p.lgu_counterpart === null ? null : <span className="tabular-nums">{formatPeso(p.lgu_counterpart)}</span>}</Field>
          </dl>
        </section>

        <section className="space-y-3" aria-labelledby="dilg-status">
          <h2 id="dilg-status" className={sectionTitle}>Status and progress</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Status (as reported)">{p.status_raw ?? SUBAYBAYAN_STATUS_LABELS[p.status]}</Field>
            <Field label="Latest OWPA (overall weighted physical accomplishment)">
              {owpa === null ? null : (
                <>
                  <span className="font-semibold tabular-nums">{p.owpa}%</span>
                  <span className="block mt-1.5 h-1.5 w-40 max-w-full rounded-full bg-sunken overflow-hidden" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${owpa}%`, backgroundColor: subaybayanStatusFill(p.status) }} />
                  </span>
                </>
              )}
            </Field>
            <Field label="Approval status">{p.approval_status}</Field>
            <Field label="Start date">{p.start_date ? formatDate(p.start_date) : null}</Field>
            <Field label="End date">{p.end_date ? formatDate(p.end_date) : null}</Field>
            <Field label="Geotagged photos (on the portal)">{p.geotagged_photos === null ? null : formatCount(p.geotagged_photos)}</Field>
          </dl>
        </section>

        <section className="space-y-3" aria-labelledby="dilg-project">
          <h2 id="dilg-project" className={sectionTitle}>Project</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Implementing LGU (project owner)">{lgu}</Field>
            <Field label="Contractor">{p.contractor}</Field>
            <Field label="Program">{p.program}</Field>
            <Field label="Project type">{p.project_type}</Field>
            <Field label="Sector">{p.sector}</Field>
            <Field label="Mode of implementation">{p.mode_of_implementation}</Field>
            {p.size_text && <Field label="Size / length">{p.size_text}</Field>}
            {p.beneficiaries_text && <Field label="Beneficiaries">{p.beneficiaries_text}</Field>}
            {p.component_details && <Field label="Components" wide>{p.component_details}</Field>}
          </dl>
        </section>

        <section className="space-y-2 text-[13px] text-subtle" aria-labelledby="dilg-source">
          <h2 id="dilg-source" className={sectionTitle}>Source</h2>
          <p>
            Source:{' '}
            <a href={info.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-accent-ink hover:underline">
              DILG SubayBAYAN – {info.label} <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
            </a>
          </p>
          <p>Retrieved {SUBAYBAYAN_RETRIEVED_LABEL} (one-time export). The portal needs a sign-in; check it for the latest status.</p>
          {p.source_file && <p className="text-muted">Export file {p.source_file}, row {p.source_row}.</p>}
          <p className="text-muted">
            Values are as reported by the LGU to DILG and have not been verified by LGU Tracker. Coordinates are area centroids, not the
            project site. DILG and DPWH may report the same project; records are kept separate and never merged.
          </p>
        </section>
      </div>
    </>
  );
}
