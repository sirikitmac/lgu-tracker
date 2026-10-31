'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Building2, Droplets, ImageOff, Landmark, MapPin, Route, Waves, type LucideIcon } from 'lucide-react';
import type { ProjectListItem } from '@/types/dpwh';
import { projectHref, sourceLabel } from '@/lib/integrations/bettergov/sources';
import { regionDisplayName, regionInfo } from '@/lib/regionPalette';
import { categoryLabel, contractMapHref, formatPeso, formatProgress, locationLabel, statusColor } from './format';
import { StatusPill } from './StatusPill';
import type { CardImage } from './categoryImages';
import { textLinkClass } from './ui';

/**
 * Reported progress as a track at its true ratio; values outside 0–100 are
 * clamped for drawing only. With a status the fill takes that status's colour,
 * so the bar agrees with the pill above it; the percentage is always printed.
 */
export function ProgressBar({ value, status, className = '' }: { value: number; status?: string | null; className?: string }) {
  const pct = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <span className={`block h-1.5 rounded-full bg-sunken overflow-hidden ${className}`} aria-hidden="true">
      <span className={`block h-full rounded-full ${status === undefined ? 'bg-ink' : ''}`} style={{ width: `${pct}%`, ...(status !== undefined ? { backgroundColor: statusColor(status) } : {}) }} />
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

/** Category tile shown when a card has no photo: the category's own icon, never a stand-in photograph. */
function CardPlaceholder({ category }: { category: string | null }) {
  const Icon = (category && CATEGORY_ICONS[category]) || ImageOff;
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-sunken text-muted">
      <Icon className="w-8 h-8 text-line-strong" strokeWidth={1.25} aria-hidden="true" />
      <span className="text-xs">No photo available</span>
    </div>
  );
}

/**
 * The card's picture, chosen for the whole page by assignCardImages: a
 * representative photo of the category (labelled, linked to its source and
 * licence) or the category tile. Decorative (empty alt): the category is
 * printed in the card, and the label says the photo is not of this project.
 * The reported status sits on the picture, where the eye lands first.
 */
export function CardMedia({
  image,
  category,
  status,
  eager,
  placeholder,
  statusLabel,
}: {
  image: CardImage | undefined;
  category: string | null;
  status: string | null;
  eager: boolean;
  /** Shown instead of the category tile when there is no photo (DILG cards use an illustrated header). */
  placeholder?: React.ReactNode;
  statusLabel?: string;
}) {
  const [failed, setFailed] = useState(false);
  const photo = image?.kind === 'representative' && !failed ? image.photo : null;
  const credit = photo ? `${photo.title} by ${photo.creator}, ${photo.license}, via Wikimedia Commons` : '';
  return (
    <div className="relative aspect-[16/9] overflow-hidden bg-sunken">
      {photo ? (
        <Image
          src={photo.src}
          alt=""
          fill
          loading={eager ? 'eager' : 'lazy'}
          sizes="(min-width: 1280px) 400px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
          onError={() => setFailed(true)}
        />
      ) : (
        placeholder ?? <CardPlaceholder category={category} />
      )}
      <span className="absolute left-3 top-3 z-10 rounded-full bg-surface shadow-raise">
        <StatusPill status={status} label={statusLabel} />
      </span>
      {photo && (
        <a
          href={photo.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`Representative photo, not of this project. ${credit}`}
          aria-label={`Representative photo, not of this project. Photo source: ${credit} (opens in a new tab)`}
          className="glass-chip absolute right-2.5 bottom-2.5 z-10 inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-medium hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
        >
          Representative photo <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

/**
 * Grid view card, read top to bottom: picture and status, the project's
 * name, what and where, how much and how far along, then the record's
 * source ID and actions. Everything else stays in the detail drawer
 * (contracts) or the record page (other sources). The title is the card's one
 * control and its hit area covers the card; the photo credit and map link sit
 * above that layer, so no interactive element is nested in another.
 */
export function DpwhProjectCard({
  item,
  image,
  onOpenContract,
  eager = false,
}: {
  item: ProjectListItem;
  image?: CardImage;
  onOpenContract: (contractId: string) => void;
  /** First-row cards load their photo at once (it is the page's largest paint); the rest lazily. */
  eager?: boolean;
}) {
  const isContract = item.source === 'dpwh_contracts';
  const mapHref = isContract ? contractMapHref({ ...item, contract_id: item.record_id }) : null;
  const title = item.contract_name ?? item.title;
  const amount = isContract ? item.contract_amount : item.budget;
  const party = item.contractor ? { label: 'Contractor', value: item.contractor } : item.implementing_office ? { label: 'Office', value: item.implementing_office } : null;
  const region = regionInfo(item.region);
  const stretch = "block w-full text-left after:absolute after:inset-0 after:z-[1] after:rounded-card after:content-[''] focus-visible:outline-none";

  return (
    <article className="group relative flex flex-col min-w-0 overflow-hidden bg-surface border border-line rounded-card transition-[box-shadow,border-color,transform] duration-200 ease-out hover:border-line-strong hover:shadow-raise motion-safe:hover:-translate-y-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink">
      <CardMedia image={image} category={item.category} status={item.status} eager={eager} />

      <div className="flex flex-col flex-1 p-4 sm:p-5">
        <h3 className="text-[15px] font-semibold leading-[1.35] text-ink break-words" title={title}>
          {isContract ? (
            <button type="button" onClick={() => onOpenContract(item.record_id)} className={stretch}><span className="line-clamp-3">{title}</span></button>
          ) : (
            <Link href={projectHref(item.source, item.record_id)} className={stretch}><span className="line-clamp-3">{title}</span></Link>
          )}
        </h3>

        <p className="mt-2 text-[13px] font-medium text-subtle">{categoryLabel(item.category)}</p>
        <p className="mt-1 flex items-start gap-1.5 text-[13px] text-muted">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            <span className="text-ink">{locationLabel(item)}</span>
            <span aria-hidden="true"> · </span>
            <span className="inline-block w-2 h-2 mr-1.5 rounded-[2px] align-[0.05em]" style={{ backgroundColor: region.color }} aria-hidden="true" />
            {item.region ? regionDisplayName(item.region) : 'Region not reported'}
          </span>
        </p>
        {party && (
          <p className="mt-1 text-[13px] text-muted truncate" title={`${party.label}: ${party.value}`}>
            {party.label}: <span className="text-subtle">{party.value}</span>
          </p>
        )}

        <dl className="mt-auto pt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-4">
          <div className="min-w-0">
            <dt className="text-xs text-muted truncate">{isContract ? 'Contract amount' : item.amount_label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink tabular-nums truncate" title={formatPeso(amount)}>{formatPeso(amount)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-muted">Progress</dt>
            <dd className="mt-0.5 text-sm tabular-nums">
              {!isContract ? (
                <span className="text-muted">Not applicable</span>
              ) : item.progress === null ? (
                <span className="text-muted">Not reported</span>
              ) : (
                <span className="text-ink font-semibold">{formatProgress(item.progress)}</span>
              )}
            </dd>
          </div>
        </dl>
        {isContract && item.progress !== null && <ProgressBar value={Number(item.progress)} status={item.status} className="mt-2" />}

        <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-3 text-xs text-muted">
          <span className="min-w-0 truncate" title={`${item.record_id} · Source: ${sourceLabel(item.source)}`}>
            <span className="font-medium text-subtle tabular-nums">{item.record_id}</span> · {sourceLabel(item.source)}
          </span>
          <span className="flex items-center gap-3 shrink-0">
            {mapHref && (
              <Link href={mapHref} className={`relative z-[2] inline-flex items-center gap-1 ${textLinkClass}`}>
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

/** Placeholder card at the real card's size while the first page loads. */
export function DpwhProjectCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden bg-surface border border-line rounded-card motion-safe:animate-pulse" aria-hidden="true">
      <div className="aspect-[16/9] bg-sunken" />
      <div className="flex flex-col gap-2 p-5 h-[232px]">
        <div className="h-4 w-11/12 rounded bg-sunken" />
        <div className="h-4 w-3/4 rounded bg-sunken" />
        <div className="h-3 w-1/3 rounded bg-sunken mt-2" />
        <div className="h-3 w-1/2 rounded bg-sunken" />
        <div className="mt-auto h-10 rounded bg-sunken" />
      </div>
    </div>
  );
}
