'use client';

import { useSyncExternalStore } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { REVIEW_COLUMNS, applyChange, newestFirst, reviewFromRow, type Review, type ReviewChange } from './logic';

/**
 * The published reviews for the landing page, kept live for everyone who has
 * the page open. Same shape as the notification store: one store and one
 * Realtime channel, however many components read it.
 *
 *   * Supabase Realtime (postgres_changes on public.reviews, which applies the
 *     same row-level security as a normal query) adds, edits and removes cards.
 *   * Realtime does not tell a visitor about a row they can no longer see, so
 *     when an administrator hides a review the page also sends a small
 *     "changed" broadcast and everyone reloads the list.
 *   * When the channel is not connected the list reloads every 30 seconds, and
 *     always when the tab comes back into view.
 */

const TOPIC = 'landing-reviews';
/** How many published reviews the page keeps: enough for the average and the cards. */
const LIMIT = 200;
const POLL_MS = 30_000;

export interface LiveReviews {
  reviews: Review[];
  /** False until the first load finished (or failed). */
  loaded: boolean;
  /** True while the Realtime channel is connected. */
  live: boolean;
}

const EMPTY: LiveReviews = { reviews: [], loaded: false, live: false };
let state: LiveReviews = EMPTY;
const listeners = new Set<() => void>();
let subscribers = 0;
let channel: RealtimeChannel | null = null;
let teardown: (() => void) | null = null;
let stopTimer: number | null = null;
let inflight: Promise<void> | null = null;
let again = false;

function set(next: Partial<LiveReviews>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

/** Reloads the list. Calls that arrive during a load are folded into one more load. */
export function refreshReviews(): Promise<void> {
  if (inflight) {
    again = true;
    return inflight;
  }
  const client = getSupabaseBrowserClient();
  if (!client) {
    set({ loaded: true });
    return Promise.resolve();
  }
  inflight = (async () => {
    try {
      const { data, error } = await client
        .from('reviews')
        .select(REVIEW_COLUMNS)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      if (!error && data) {
        set({ reviews: newestFirst(data.map(reviewFromRow).filter((r): r is Review => r !== null)), loaded: true });
      } else {
        set({ loaded: true });
      }
    } finally {
      inflight = null;
      if (again) {
        again = false;
        void refreshReviews();
      }
    }
  })();
  return inflight;
}

/** Applies a change made in this tab straight away (the author should not wait for the round trip). */
export function applyLocalChange(change: ReviewChange) {
  set({ reviews: applyChange(state.reviews, change) });
}

/** Tells every open page to reload the list (used after hiding, which Realtime cannot announce to visitors). */
export function announceReviewsChanged() {
  if (!channel) return;
  void channel.send({ type: 'broadcast', event: 'changed', payload: {} }).catch(() => undefined);
}

function onChange(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as { id?: unknown } | null)?.id;
    if (typeof id === 'string') applyLocalChange({ type: 'remove', id });
    return;
  }
  const review = reviewFromRow(payload.new);
  if (review) applyLocalChange({ type: 'upsert', review });
  else void refreshReviews();
}

function start() {
  if (stopTimer !== null) {
    // Mounted again before the delayed stop (React's development double mount, a fast remount).
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (teardown) return;
  const client = getSupabaseBrowserClient();
  if (!client) {
    set({ loaded: true });
    return;
  }

  // A channel left over under the same topic would make supabase-js hand it back already
  // subscribed, and adding callbacks to it throws. Remove it, then set everything up
  // before subscribe().
  for (const old of client.getChannels()) {
    if (old.topic === `realtime:${TOPIC}`) void client.removeChannel(old);
  }
  const ch = client
    .channel(TOPIC, { config: { broadcast: { self: false } } })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, onChange)
    .on('broadcast', { event: 'changed' }, () => void refreshReviews());
  channel = ch;
  ch.subscribe((status) => {
    if (channel !== ch) return;
    const live = status === 'SUBSCRIBED';
    if (live !== state.live) set({ live });
    if (live) void refreshReviews(); // catch up on anything missed while connecting
  });

  void refreshReviews();
  const onVisible = () => document.visibilityState === 'visible' && void refreshReviews();
  const onFocus = () => void refreshReviews();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onFocus);
  const timer = window.setInterval(() => {
    if (!state.live && document.visibilityState === 'visible') void refreshReviews();
  }, POLL_MS);

  teardown = () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onFocus);
    window.clearInterval(timer);
    if (channel) void client.removeChannel(channel);
    channel = null;
    teardown = null;
    set({ live: false });
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  subscribers += 1;
  start();
  return () => {
    listeners.delete(listener);
    subscribers -= 1;
    if (subscribers === 0 && stopTimer === null) {
      stopTimer = window.setTimeout(() => {
        stopTimer = null;
        if (subscribers === 0) teardown?.();
      }, 1000);
    }
  };
}

/** The published reviews, newest first; kept up to date while mounted. */
export function useLiveReviews(): LiveReviews {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}
