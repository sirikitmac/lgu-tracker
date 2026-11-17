'use client';

import React, { useEffect, useState } from 'react';
import {
  DEFAULT_BADGE_STYLES,
  readableTextColor,
  resolveBadge,
  stylesFromRows,
  type BadgeInput,
  type BadgeStyle,
  type BadgeStyles,
} from '@/lib/badges/badges';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

const CHANGED = 'lgu:badge-styles-changed';

let cached: BadgeStyles | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(s: BadgeStyles) => void>();

function load(force = false) {
  if (loading && !force) return;
  const client = getSupabaseBrowserClient();
  if (!client) return;
  loading = Promise.resolve(client.from('role_badge_styles').select('tier, label, color'))
    .then(({ data }) => {
      cached = stylesFromRows(data);
      listeners.forEach((fn) => fn(cached as BadgeStyles));
    })
    .catch(() => undefined)
    .finally(() => {
      loading = null;
    });
}

/** Tell every pill on the page to re-read the colours (after an administrator saves them). */
export function announceBadgeStylesChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED));
  cached = null;
  load(true);
}

/** The current pill styles: the defaults at first, then what administrators set. Read once per page and shared. */
export function useBadgeStyles(initial?: BadgeStyles): BadgeStyles {
  const [styles, setStyles] = useState<BadgeStyles>(initial ?? cached ?? DEFAULT_BADGE_STYLES);
  useEffect(() => {
    listeners.add(setStyles);
    if (cached) setStyles(cached);
    else load();
    return () => {
      listeners.delete(setStyles);
    };
  }, []);
  return styles;
}

/** A pill with the given look; also used for live previews while editing. */
export function Pill({ style, className = '' }: { style: BadgeStyle; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${className}`}
      style={{ backgroundColor: style.color, color: readableTextColor(style.color) }}
    >
      {style.label}
    </span>
  );
}

/**
 * The role pill beside a name. Nothing is drawn for citizens, contractors and
 * anonymous items (no kind), so callers can render it unconditionally.
 */
export function RoleBadge({ tier, customLabel, customColor, styles, className }: BadgeInput & { styles?: BadgeStyles; className?: string }) {
  const live = useBadgeStyles(styles);
  const badge = resolveBadge({ tier, customLabel, customColor }, live);
  if (!badge) return null;
  return <Pill style={badge} className={className} />;
}
