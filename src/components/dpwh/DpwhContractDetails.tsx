'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { DpwhComponent } from '@/types/dpwh';
import type { DpwhContractDetail } from '@/lib/integrations/dpwh/nationwide/detail';
import {
  categoryLabel,
  durationDays,
  formatDate,
  formatPeso,
  formatProgress,
  statusLabel,
  warningLabel,
} from './format';

function Field({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="py-2 grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3 text-sm">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="text-ink break-words">
        {value === null || value === undefined || value === '' ? <span className="text-muted">Not reported</span> : value}
        {note && <span className="block text-xs text-muted mt-0.5">{note}</span>}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-sm font-semibold tracking-tight text-ink border-b border-line pb-2">{title}</h3>
      <dl className="divide-y divide-sunken">{children}</dl>
    </section>
  );
}

function SourceLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
      {children} <ExternalLink className="w-3 h-3" aria-hidden="true" />
    </a>
  );
}

/** Every available source field of one DPWH contract, grouped for reading. */
export function DpwhContractDetails({ detail }: { detail: DpwhContractDetail }) {
  const c = detail.contract;
  const duration = durationDays(c.contract_effectivity_date ?? c.start_date, c.expiry_date ?? c.completion_date);

  return (
    <div className="space-y-6">
      <p className="text-xs text-subtle leading-relaxed px-4 py-3 rounded-card bg-sunken">
        Source-reported values from the DPWH Transparency Portal via BetterGov.ph. Amounts are reported contract
        values, not disbursements. {detail.review?.is_field_verified
          ? `Field-verified by the LGU on ${formatDate(detail.review.verified_at)}.`
          : 'Not field-verified by the LGU.'}
      </p>

      <Section title="Project">
        <Field label="Contract ID" value={c.contract_id} />
        <Field label="Project name" value={c.contract_name} note="Procurement contract name" />
        <Field label="Description" value={c.title} />
        <Field label="Category" value={categoryLabel(c.category)} note={`Classified by ${c.category_method.replace(/_/g, ' ')}: ${c.category_reason}`} />
        <Field label="Source category" value={c.source_category} />
        <Field label="Status" value={statusLabel(c.status)} note={c.source_status ? `Source status "${c.source_status}"` : undefined} />
        <Field label="Reported progress" value={c.progress === null ? null : formatProgress(c.progress)} />
        <Field label="Infrastructure year" value={c.infra_year} />
      </Section>

      <Section title="Reported location">
        <Field label="Region" value={c.region} note={c.provinces.length > 1 ? 'Components span several locations.' : undefined} />
        <Field label="Province" value={c.province ?? (c.provinces.length ? c.provinces.join(', ') : null)} />
        <Field label="City / municipality" value={c.municipality} />
        <Field label="Barangay" value={c.barangay} />
        <Field
          label="Coordinates"
          value={c.latitude !== null && c.longitude !== null ? `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}` : null}
          note={c.latitude !== null ? 'DPWH-reported; not verified.' : undefined}
        />
      </Section>

      <Section title="Implementing office">
        <Field label="Office" value={c.implementing_office} note="The DPWH office running the contract, not the project location." />
        <Field label="Office region" value={c.implementing_region} />
      </Section>

      <Section title="Contract and amounts">
        <Field label="Contractor" value={c.contractor} />
        <Field label="Winning bidder(s)" value={c.winner_names} />
        <Field label="Contract amount" value={c.contract_amount === null ? null : formatPeso(c.contract_amount)} note="Award amount as reported" />
        <Field label="Approved budget (ABC)" value={c.approved_budget === null ? null : formatPeso(c.approved_budget)} />
        <Field label="DPWH budget field" value={c.budget === null ? null : formatPeso(c.budget)} />
        <Field label="Amount paid" value={c.amount_paid === null ? null : formatPeso(c.amount_paid)} note="As reported; DPWH usually reports 0. Not disbursement data." />
        <Field label="Program" value={c.program_name} />
        <Field label="Source of funds" value={c.source_of_funds} />
        <Field label="Funding instrument" value={c.funding_instrument} />
      </Section>

      <Section title="Dates">
        <Field label="Start" value={c.start_date && formatDate(c.start_date)} />
        <Field label="Completion" value={c.completion_date && formatDate(c.completion_date)} />
        <Field label="Contract effectivity" value={c.contract_effectivity_date && formatDate(c.contract_effectivity_date)} />
        <Field label="Contract expiry" value={c.expiry_date && formatDate(c.expiry_date)} />
        <Field label="Contract duration" value={duration === null ? null : `${duration} days`} note="Computed from the reported dates" />
      </Section>

      <Section title="Procurement and documents">
        <Field label="Advertised" value={c.advertisement_date && formatDate(c.advertisement_date)} />
        <Field label="Bid deadline" value={c.bid_submission_deadline && formatDate(c.bid_submission_deadline)} />
        <Field label="Awarded" value={c.award_date && formatDate(c.award_date)} />
        <Field label="Procurement status code" value={c.procurement_status_code} />
        <Field
          label="Documents"
          value={
            [c.link_advertisement, c.link_notice_of_award, c.link_contract_agreement, c.link_notice_to_proceed].some(Boolean) ? (
              <span className="flex flex-col gap-1">
                <SourceLink href={c.link_advertisement}>Bidding documents</SourceLink>
                <SourceLink href={c.link_notice_of_award}>Notice of award</SourceLink>
                <SourceLink href={c.link_contract_agreement}>Contract agreement</SourceLink>
                <SourceLink href={c.link_notice_to_proceed}>Notice to proceed</SourceLink>
              </span>
            ) : null
          }
        />
      </Section>

      {c.components.length > 0 && (
        <Section title={`Components (${c.components.length})`}>
          {c.components.map((part: DpwhComponent, i) => (
            <Field
              key={part.component_id ?? i}
              label={part.component_id ?? `Component ${i + 1}`}
              value={part.type_of_work}
              note={[part.province, part.region].filter(Boolean).join(', ') || undefined}
            />
          ))}
        </Section>
      )}

      {c.data_warnings.length > 0 && (
        <Section title="Data-quality notes">
          <ul className="py-2 space-y-1 text-xs text-warn-ink list-disc pl-5">
            {c.data_warnings.map((w) => <li key={w}>{warningLabel(w)}</li>)}
          </ul>
        </Section>
      )}

      <Section title="Source">
        <Field label="Dataset" value={<SourceLink href={c.source_file_url}>BetterGov.ph DPWH dataset (Hugging Face)</SourceLink>} note={`Revision ${c.source_revision.slice(0, 10)}`} />
        <Field label="BetterGov record" value={<SourceLink href={c.bettergov_record_url}>Open record</SourceLink>} />
        <Field
          label="Site photos (DPWH)"
          value={c.total_images === null ? null : `${c.total_images} reported${c.latest_image_date ? `, latest ${formatDate(c.latest_image_date)}` : ''}`}
          note="DPWH reports how many site photos it holds. LGU Tracker does not store or show them; see the DPWH Transparency Portal."
        />
        <Field label="Source snapshot" value={formatDate(c.source_snapshot_at)} note="Snapshot in which these values last changed" />
        <Field label="Last successful sync" value={detail.lastSuccessfulSyncAt && formatDate(detail.lastSuccessfulSyncAt)} />
      </Section>
    </div>
  );
}
