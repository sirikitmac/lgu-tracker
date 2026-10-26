'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Building2, Droplets, ImageOff, Landmark, MapPin, Route, Waves, type LucideIcon } from 'lucide-react';
import type { ProjectListItem } from '@/types/dpwh';
import { projectHref, sourceLabel } from '@/lib/integrations/bettergov/sources';
import { categoryLabel, contractMapHref, formatPeso, formatProgress, locationLabel } from './format';
import { StatusPill } from './StatusPill';
import { categoryPhoto } from './categoryImages';
import { textLinkClass } from './ui';

/** Reported progress as a track at its true ratio; values outside 0–100 are clamped for drawing only. */
export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <span className={`block h-1.5 rounded-full bg-sunken overflow-hidden ${className}`} aria-hidden="true">
      <span className="block h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
    </span>
  );
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  roads_highways: Route,
  bridges: Landmark,
  flood_control_drainage: Waves,
  buildings_facilities: Building2,
  water_infrastructure: Droplets,
};

/**
 * The card's picture: a representative photo of the category, labelled as
 * such, or a plain tile when the category has none or the file fails to load.
 * Decorative (empty alt): the category is printed in the card itself.
 */
function CardMedia({ category }: { category: string | null }) {
  const photo = categoryPhoto(category);
  const [failed, setFailed] = useState(false);
  const Icon = (category && CATEGORY_ICONS[category]) || ImageOff;

  if (!photo || failed) {
    return (
      <div className="relative aspect-[5/2] flex flex-col items-center justify-center gap-1.5 bg-sunken text-muted">
        <Icon className="w-6 h-6" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-xs">No photo for this category</span>
      </div>
    );
  }
  return (
    <div className="relative aspect-[5/2] overflow-hidden bg-sunken">
      <Image
        src={photo.src}
        alt=""
        fill
        sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
        className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
        onError={() => setFailed(true)}
      />
      <span className="absolute left-2 bottom-2 inline-flex items-center h-6 px-2 rounded-full glass-strong text-[11px] font-medium text-ink">
        Representative photo
      </span>
    </div>
  );
}

/**
 * Grid view card: the few fields people scan first. Everything else stays in
 * the detail drawer (contracts) or the record page (other sources). The title
 * is the card's one control and its hit area covers the card; the map link
 * sits above that layer.
 */
export function DpwhProjectCard({ item, onOpenContract }: { item: ProjectListItem; onOpenContract: (contractId: string) => void }) {
  const isContract = item.source === 'dpwh_contracts';
  const mapHref = isContract ? contractMapHref({ ...item, contract_id: item.record_id }) : null;
  const title = item.contract_name ?? item.title;
  const amount = isContract ? item.contract_amount : item.budget;
  const party = item.contractor ? { label: 'Contractor', value: item.contractor } : item.implementing_office ? { label: 'Office', value: item.implementing_office } : null;
  const stretch = "block w-full text-left after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:outline-none";

  return (
    <article className="group relative flex flex-col min-w-0 overflow-hidden bg-surface border border-line rounded-card transition-[box-shadow,border-color,transform] duration-200 ease-out hover:border-line-strong hover:shadow-raise hover:-translate-y-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink">
      <CardMedia category={item.category} />

      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted truncate">{categoryLabel(item.category)}</span>
          <StatusPill status={item.status} />
        </div>

        <h3 className="mt-2 text-[15px] font-semibold leading-snug text-ink" title={title}>
          {isContract ? (
            <button type="button" onClick={() => onOpenContract(item.record_id)} className={stretch}><span className="line-clamp-2">{title}</span></button>
          ) : (
            <Link href={projectHref(item.source, item.record_id)} className={stretch}><span className="line-clamp-2">{title}</span></Link>
          )}
        </h3>

        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0">
            {locationLabel(item)}
            <span className="text-muted"> · {item.region ?? 'Region not reported'}</span>
          </span>
        </p>
        {party && (
          <p className="mt-1 mb-1 text-xs text-muted truncate" title={`${party.label}: ${party.value}`}>
            {party.label}: <span className="text-subtle">{party.value}</span>
          </p>
        )}

        <dl className="mt-auto pt-3 border-t border-line grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 items-start">
          <div className="min-w-0">
            <dt className="text-xs text-muted truncate">{isContract ? 'Contract amount' : item.amount_label}</dt>
            <dd className="mt-0.5 text-base font-semibold text-ink tabular-nums truncate">{formatPeso(amount)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-muted">Progress</dt>
            <dd className="mt-0.5 text-sm tabular-nums">
              {!isContract ? (
                <span className="text-muted">Not applicable</span>
              ) : item.progress === null ? (
                <span className="text-muted">Not reported</span>
              ) : (
                <>
                  <span className="text-ink font-medium">{formatProgress(item.progress)}</span>
                  <ProgressBar value={Number(item.progress)} className="w-16 ml-auto mt-1" />
                </>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
          <span className="truncate" title={`${item.record_id} · Source: ${sourceLabel(item.source)}`}>
            {item.record_id} · {sourceLabel(item.source)}
          </span>
          <span className="flex items-center gap-3 shrink-0">
            {mapHref && (
              <Link href={mapHref} className={`relative z-10 inline-flex items-center gap-1 ${textLinkClass}`}>
                <MapPin className="w-3 h-3" aria-hidden="true" /> Map
              </Link>
            )}
            <span className="inline-flex items-center gap-0.5 font-semibold text-ink" aria-hidden="true">
              View details <ArrowUpRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}

/** Placeholder card at the real card's size while the first page loads. */
export function DpwhProjectCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden bg-surface border border-line rounded-card" aria-hidden="true">
      <div className="aspect-[5/2] bg-sunken" />
      <div className="flex flex-col gap-2 p-4 h-[196px]">
        <div className="flex justify-between"><div className="h-3 w-24 rounded bg-sunken" /><div className="h-6 w-20 rounded-full bg-sunken" /></div>
        <div className="h-4 w-11/12 rounded bg-sunken" />
        <div className="h-4 w-3/4 rounded bg-sunken" />
        <div className="h-3 w-1/2 rounded bg-sunken" />
        <div className="mt-auto h-10 rounded bg-sunken" />
      </div>
    </div>
  );
}
