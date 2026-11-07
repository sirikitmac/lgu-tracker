'use client';

import { useSyncExternalStore } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * The number of unread notifications for whoever is signed in, shared by the
 * bell in the top bar and the sidebar. One store, one realtime channel, however
 * many components read it.
 *
 * It updates when a notification arrives (Supabase Realtime, which applies the
 * same row-level security as a normal query), when the tab becomes visible
 * again, and every few minutes as a fallback. It is only a number to show: the
 * inbox itself loads on the server.
 */

let count = 0;
let started = false;
let subscribers = 0;
let userId: string | null = null;
const listeners = new Set<() => void>();
let teardown: (() => void) | null = null;
let channelSeq = 0;

function emit(next: number) {
  if (next === count) return;
  count = next;
  listeners.forEach((listener) => listener());
}

async function refresh() {
  const client = getSupabaseBrowserClient();
  if (!client || !userId) return emit(0);
  const { count: unread, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (!error) emit(unread ?? 0);
}

/** Ask for a fresh count, e.g. right after marking things read. */
export function refreshUnread() {
  void refresh();
}

function start() {
  const client = getSupabaseBrowserClient();
  if (!client || started) return;
  started = true;

  let channel: ReturnType<typeof client.channel> | null = null;
  const watch = (id: string | null) => {
    if (id === userId && channel) return;
    if (channel) void client.removeChannel(channel);
    channel = null;
    userId = id;
    if (!id) return emit(0);
    channel = client
      // A fresh topic each time: supabase-js hands back an existing channel with the same
      // topic (already subscribed while the old one is still being removed), and adding
      // callbacks to it throws "cannot add postgres_changes callbacks after subscribe()".
      .channel(`inbox-${id}-${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${id}` }, () => void refresh())
      .subscribe();
    void refresh();
  };

  void client.auth.getSession().then(({ data }) => watch(data.session?.user.id ?? null));
  const { data: auth } = client.auth.onAuthStateChange((_event, session) => watch(session?.user.id ?? null));
  const onVisible = () => document.visibilityState === 'visible' && void refresh();
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(onVisible, 3 * 60 * 1000);

  teardown = () => {
    auth.subscription.unsubscribe();
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
    if (channel) void client.removeChannel(channel);
    started = false;
    userId = null;
    teardown = null;
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  subscribers += 1;
  start();
  return () => {
    listeners.delete(listener);
    subscribers -= 1;
    if (subscribers === 0) teardown?.();
  };
}

/** Unread count; 0 while unknown or signed out. */
export function useUnreadCount(): number {
  return useSyncExternalStore(subscribe, () => count, () => 0);
}
