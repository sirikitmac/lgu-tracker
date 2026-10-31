'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Droplets,
  FolderOpen,
  HandHeart,
  Hospital,
  House,
  Landmark,
  Leaf,
  Lightbulb,
  MapPin,
  Recycle,
  Route,
  ShieldAlert,
  Sprout,
  Store,
  Trees,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ProjectListItem } from '@/types/dpwh';
import { projectHref, subaybayanMapHref } from '@/lib/integrations/bettergov/sources';
import { regionDisplayName, regionInfo } from '@/lib/regionPalette';
import { SUBAYBAYAN_CATEGORY_COLORS, SUBAYBAYAN_CATEGORY_LABELS, SUBAYBAYAN_CATEGORY_SHORT, type SubaybayanCategory } from '@/lib/subaybayan/categories';
import { implementingLgu, isApproximate, placeLine } from '@/lib/subaybayan/ui';
import { CardMedia, ProgressBar } from '@/components/dpwh/DpwhProjectCard';
import type { CardImage } from '@/components/dpwh/categoryImages';
import { formatPeso, formatProgress, readableTitle } from '@/components/dpwh/format';
import { textLinkClass } from '@/components/dpwh/ui';

/**
 * DILG SubayBAYAN rows of the project directory (/projects): the grid card,
 * the illustrated header used when no representative photo fits, and the
 * amount notes shared with the table.
 */

const SUBCATEGORY_ICONS: Record<string, LucideIcon> = {
  'Roads and bridges': Route,
  'Water supply systems': Droplets,
  'Public buildings': Landmark,
  'Markets and multipurpose buildings': Store,
  'Other public infrastructure': Lightbulb,
  'Evacuation centers': House,
  'Disaster mitigation and preparedness': ShieldAlert,
  'Health facilities': Hospital,
  'Social services': HandHeart,
  'Community development programs': Users,
  'Livelihood initiatives': Sprout,
  'Community facilities': Trees,
  'Waste and sanitation': Recycle,
  'Environmental protection': Leaf,
};

export const dilgCategoryColor = (c: SubaybayanCategory | null) => SUBAYBAYAN_CATEGORY_COLORS[c ?? 'uncategorized'];

/** "Health and social services · Social services" (no repeat for Uncategorized). */
export function dilgCategoryLine(item: Pick<ProjectListItem, 'sector_category' | 'sector_subcategory'>): string {
  const cat = item.sector_category ? SUBAYBAYAN_CATEGORY_LABELS[item.sector_category] : 'Uncategorized';
  const sub = item.sector_subcategory;
  return sub && sub !== 'Uncategorized' ? `${cat} · ${sub}` : cat;
}

/**
 * Card header for a DILG project without a fitting photo: the subcategory's
 * icon on a tint of its category colour. It is an illustration, never a
 * stand-in photograph, and says so.
 */
export function DilgIllustration({ category, subcategory }: { category: SubaybayanCategory | null; subcategory: string | null }) {
  const color = dilgCategoryColor(category);
  const Icon = (subcategory && SUBCATEGORY_ICONS[subcategory]) || FolderOpen;
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2"
      style={{ backgroundColor: `color-mix(in oklab, ${color} 13%, var(--color-surface))` }}
    >
      <span
        className="grid place-items-center w-14 h-14 rounded-2xl"
        style={{ backgroundColor: `color-mix(in oklab, ${color} 22%, var(--color-surface))`, color }}
      >
        <Icon className="w-7 h-7" strokeWidth={1.6} aria-hidden="true" />
      </span>
      <span className="text-xs font-medium text-subtle">{category ? SUBAYBAYAN_CATEGORY_SHORT[category] : 'Uncategorized'}</span>
      <span className="absolute right-2.5 bottom-2.5 text-[11px] text-muted">Illustration · no project photo</span>
    </div>
  );
}

/** "adjusted" and "Amount not verified" notes under a DILG total. */
export function DilgAmountNotes({ item, className = '' }: { item: Pick<ProjectListItem, 'cost_adjusted' | 'amount_needs_review'>; className?: string }) {
  if (!item.cost_adjusted && !item.amount_needs_review) return null;
  return (
    <span className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] leading-tight ${className}`}>
      {item.amount_needs_review && (
        <span className="inline-flex items-center gap-1 font-medium text-warn-ink" title="This total is extreme for its kind of project (at least P100M and 100x the typical total) and has not been verified. It is shown as reported and ranked after verified amounts.">
          <TriangleAlert className="w-3 h-3 shrink-0" aria-hidden="true" /> Amount not verified
        </span>
      )}
      {item.cost_adjusted && (
        <span className="text-warn-ink" title="The reported total looked like a data-entry error; another amount from the same record is shown. Open the project to see what was reported.">
          adjusted
        </span>
      )}
    </span>
  );
}

/** Place line for a DILG row: barangay, city/municipality, province, with "approx." for area centroids. */
export function DilgPlace({ item }: { item: ProjectListItem }) {
  return (
    <>
      {placeLine({ barangay: item.barangay, citymun: item.municipality, province: item.province }).replace(/ (Of|De|Del) /g, (m) => m.toLowerCase())}
      {item.location_precision && isApproximate(item.location_precision) && (
        <span className="text-muted" title="Mapped at the centre of the city/municipality or province, not the project site."> · approx.</span>
      )}
    </>
  );
}

export function DilgProjectCard({ item, image, eager = false }: { item: ProjectListItem; image?: CardImage; eager?: boolean }) {
  const title = readableTitle(item.title);
  const region = regionInfo(item.region);
  const lgu = implementingLgu(item);
  const stretch = "block w-full text-left after:absolute after:inset-0 after:z-[1] after:rounded-card after:content-[''] focus-visible:outline-none";
  const progress = item.progress === null ? null : Number(item.progress);
  const amount = item.total_cost;

  return (
    <article className="group relative flex flex-col min-w-0 overflow-hidden bg-surface border border-line rounded-card transition-[box-shadow,border-color,transform] duration-200 ease-out hover:border-line-strong hover:shadow-raise motion-safe:hover:-translate-y-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink">
      <div className="relative">
        <CardMedia
          image={image}
          category={item.category}
          status={item.status}
          statusLabel={item.status === 'terminated' ? 'Cancelled / terminated' : undefined}
          eager={eager}
          placeholder={<DilgIllustration category={item.sector_category} subcategory={item.sector_subcategory} />}
        />
        <span className="absolute right-3 top-3 z-10 inline-flex items-center h-6 px-2 rounded-full bg-surface shadow-raise text-[11.5px] font-semibold text-ink">
          DILG SubayBAYAN
        </span>
      </div>

      <div className="flex flex-col flex-1 p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold leading-[1.35] text-ink break-words" title={item.title}>
          <Link href={projectHref(item.source, item.record_id)} className={stretch}>
            <span className="line-clamp-3">{title}</span>
          </Link>
        </h3>

        <p className="mt-2 flex items-start gap-1.5 text-[13px] font-medium text-subtle">
          <span className="w-2 h-2 mt-[5px] shrink-0 rounded-full" style={{ backgroundColor: dilgCategoryColor(item.sector_category) }} aria-hidden="true" />
          <span className="min-w-0" title="LGU Tracker classification, not an official DILG category">{dilgCategoryLine(item)}</span>
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 line-clamp-3">
            <span className="text-ink"><DilgPlace item={item} /></span>
            <span aria-hidden="true"> · </span>
            <span className="inline-block w-2 h-2 mr-1.5 rounded-[2px] align-[0.05em]" style={{ backgroundColor: region.color }} aria-hidden="true" />
            {item.region ? regionDisplayName(item.region) : 'Region not reported'}
          </span>
        </p>
        {lgu && (
          <p className="mt-1 text-[13px] text-muted truncate" title={`Implementing LGU: ${lgu}`}>
            Implementing LGU: <span className="text-subtle">{lgu}</span>
          </p>
        )}
        {item.contractor && (
          <p className="mt-0.5 text-[13px] text-muted truncate" title={`Contractor: ${item.contractor}`}>
            Contractor: <span className="text-subtle">{item.contractor}</span>
          </p>
        )}

        <dl className="mt-auto pt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4">
          <div className="min-w-0">
            <dt className="text-xs text-muted truncate">Total project cost</dt>
            <dd className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink tabular-nums truncate" title={formatPeso(amount)}>
              {formatPeso(amount)}
            </dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-muted" title="Overall weighted physical accomplishment reported to SubayBAYAN">Progress (OWPA)</dt>
            <dd className="mt-0.5 text-sm tabular-nums">
              {progress === null ? <span className="text-muted">Not reported</span> : <span className="text-ink font-semibold">{formatProgress(progress)}</span>}
            </dd>
          </div>
        </dl>
        <DilgAmountNotes item={item} className="mt-1" />
        {progress !== null && <ProgressBar value={progress} status={item.status} className="mt-2" />}

        <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 text-xs text-muted">
          <span className="min-w-0 truncate" title={`Project code ${item.project_code ?? 'not assigned'} · Source: DILG SubayBAYAN`}>
            <span className="font-medium text-subtle tabular-nums">{item.project_code ?? 'No project code'}</span> · DILG
          </span>
          <span className="flex items-center gap-3 shrink-0">
            {item.latitude !== null && (
              <Link href={subaybayanMapHref(item.record_id)} className={`relative z-[2] inline-flex items-center gap-1 ${textLinkClass}`}>
                <MapPin className="w-3 h-3" aria-hidden="true" /> Map
              </Link>
            )}
            <span className="inline-flex items-center gap-0.5 font-semibold text-ink" aria-hidden="true">
              Details <ArrowUpRight className="w-3 h-3 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" />
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
