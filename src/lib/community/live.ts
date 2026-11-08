'use client';

import { useSyncExternalStore } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { scoreAfterVote } from './logic';
import { COMMENT_COLUMNS, POST_COLUMNS, commentFromRow, postFromRow, upsertById, writeErrorMessage } from './rows';
import type { Comment, Post, Vote } from './types';

/**
 * The community's discussions, comments and your votes, read from Supabase and
 * kept live for everyone who has a community page open. One store and one
 * Realtime channel, however many components read it.
 *
 *   * Realtime (postgres_changes on community_posts and community_comments)
 *     adds, changes and removes items. Scores and comment counts are changed
 *     by database triggers, so a vote reaches everyone as an update of the row.
 *   * When the channel is not connected the lists reload every 30 seconds, and
 *     always when the tab comes back into view or the session changes.
 *   * Your own writes show at once; votes are applied before the round trip
 *     and put back if the database refuses them.
 */

const TOPIC = 'community-live';
const POST_LIMIT = 200;
const COMMENT_LIMIT = 2000;
const POLL_MS = 30_000;

export interface CommunityState {
  posts: Post[];
  comments: Comment[];
  /** Your votes by post or comment id. Empty when signed out. */
  myVotes: Record<string, Vote>;
  /** The signed-in account, if any. */
  userId: string | null;
  /** False until the first load finished (or failed). */
  loaded: boolean;
  /** True when the first load failed and nothing is shown. */
  failed: boolean;
  /** True while the Realtime channel is connected. */
  live: boolean;
}

const EMPTY: CommunityState = { posts: [], comments: [], myVotes: {}, userId: null, loaded: false, failed: false, live: false };
let state: CommunityState = EMPTY;
const listeners = new Set<() => void>();
let subscribers = 0;
let channel: RealtimeChannel | null = null;
let teardown: (() => void) | null = null;
let stopTimer: number | null = null;
let inflight: Promise<void> | null = null;
let again = false;

function set(next: Partial<CommunityState>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

/** Reloads everything. Calls that arrive during a load are folded into one more load. */
export function refreshCommunity(): Promise<void> {
  if (inflight) {
    again = true;
    return inflight;
  }
  const client = getSupabaseBrowserClient();
  if (!client) {
    set({ loaded: true, failed: true });
    return Promise.resolve();
  }
  inflight = (async () => {
    try {
      const { data: session } = await client.auth.getSession();
      const userId = session.session?.user.id ?? null;
      const [posts, comments, votes] = await Promise.all([
        client.from('community_posts').select(POST_COLUMNS).order('created_at', { ascending: false }).limit(POST_LIMIT),
        client.from('community_comments').select(COMMENT_COLUMNS).order('created_at', { ascending: true }).limit(COMMENT_LIMIT),
        userId ? client.from('community_votes').select('post_id, comment_id, value') : Promise.resolve({ data: [], error: null }),
      ]);
      if (posts.error || comments.error || !posts.data || !comments.data) {
        set({ loaded: true, failed: state.posts.length === 0 });
        return;
      }
      const myVotes: Record<string, Vote> = {};
      for (const v of (votes.data ?? []) as { post_id: string | null; comment_id: string | null; value: number }[]) {
        const id = v.post_id ?? v.comment_id;
        if (id && (v.value === 1 || v.value === -1)) myVotes[id] = v.value;
      }
      set({
        posts: posts.data.map(postFromRow).filter((p): p is Post => p !== null),
        comments: comments.data.map(commentFromRow).filter((c): c is Comment => c !== null),
        // Keep what the database could not tell us about (the votes query is skipped signed out).
        myVotes: votes.error ? state.myVotes : myVotes,
        userId,
        loaded: true,
        failed: false,
      });
    } catch {
      set({ loaded: true, failed: state.posts.length === 0 });
    } finally {
      inflight = null;
      if (again) {
        again = false;
        void refreshCommunity();
      }
    }
  })();
  return inflight;
}

function onPost(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as { id?: unknown } | null)?.id;
    if (typeof id === 'string') set({ posts: state.posts.filter((p) => p.id !== id), comments: state.comments.filter((c) => c.postId !== id) });
    return;
  }
  const post = postFromRow(payload.new);
  if (post) set({ posts: upsertById(state.posts, post) });
  else void refreshCommunity();
}

function onComment(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
  if (payload.eventType === 'DELETE') {
    const id = (payload.old as { id?: unknown } | null)?.id;
    // Replies go with their parent in the database; reload to learn which ones.
    if (typeof id === 'string') set({ comments: state.comments.filter((c) => c.id !== id) });
    void refreshCommunity();
    return;
  }
  const comment = commentFromRow(payload.new);
  if (comment) set({ comments: upsertById(state.comments, comment) });
  else void refreshCommunity();
}

function start() {
  if (stopTimer !== null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
  if (teardown) return;
  const client = getSupabaseBrowserClient();
  if (!client) {
    set({ loaded: true, failed: true });
    return;
  }

  // Remove a channel left over under this topic (supabase-js would hand it back
  // already subscribed), then add every callback before subscribe().
  for (const old of client.getChannels()) {
    if (old.topic === `realtime:${TOPIC}`) void client.removeChannel(old);
  }
  const ch = client
    .channel(TOPIC)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, onPost)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'community_comments' }, onComment);
  channel = ch;
  ch.subscribe((status) => {
    if (channel !== ch) return;
    const live = status === 'SUBSCRIBED';
    if (live !== state.live) set({ live });
    if (live) void refreshCommunity(); // catch up on anything missed while connecting
  });

  void refreshCommunity();
  const onVisible = () => document.visibilityState === 'visible' && void refreshCommunity();
  const onFocus = () => void refreshCommunity();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onFocus);
  const { data: auth } = client.auth.onAuthStateChange((event) => {
    // Sign in or out: your votes and the "you" in the lists change.
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      if (event === 'SIGNED_OUT') set({ myVotes: {}, userId: null });
      void refreshCommunity();
    }
  });
  const timer = window.setInterval(() => {
    if (!state.live && document.visibilityState === 'visible') void refreshCommunity();
  }, POLL_MS);

  teardown = () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onFocus);
    window.clearInterval(timer);
    auth.subscription.unsubscribe();
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

/** Discussions, comments and your votes; kept up to date while mounted. */
export function useCommunity(): CommunityState {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

// ---------------------------------------------------------------------------
// Writes. The database is the real gate (row-level security and guard triggers
// fill in the author, the counts and the rate limit); these report friendly errors.
// ---------------------------------------------------------------------------

export type WriteResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function me() {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session ? { client, userId: data.session.user.id } : null;
}

const SIGN_IN = 'Please sign in first.';

export async function createPost(input: { title: string; body: string; project?: { title: string; code?: string; href: string } }): Promise<WriteResult<Post>> {
  const who = await me();
  if (!who) return { ok: false, error: SIGN_IN };
  const { data, error } = await who.client
    .from('community_posts')
    .insert({
      author_id: who.userId,
      title: input.title.trim(),
      body: input.body.trim(),
      project_title: input.project?.title ?? null,
      project_code: input.project?.code ?? null,
      project_href: input.project?.href ?? null,
    })
    .select(POST_COLUMNS)
    .single();
  const post = error ? null : postFromRow(data);
  if (!post) return { ok: false, error: writeErrorMessage(error) };
  set({ posts: upsertById(state.posts, post) });
  return { ok: true, data: post };
}

export async function createComment(input: { postId: string; parentId: string | null; body: string }): Promise<WriteResult<Comment>> {
  const who = await me();
  if (!who) return { ok: false, error: SIGN_IN };
  const { data, error } = await who.client
    .from('community_comments')
    .insert({ post_id: input.postId, parent_id: input.parentId, author_id: who.userId, body: input.body.trim() })
    .select(COMMENT_COLUMNS)
    .single();
  const comment = error ? null : commentFromRow(data);
  if (!comment) return { ok: false, error: writeErrorMessage(error) };
  set({
    comments: upsertById(state.comments, comment),
    posts: state.posts.map((p) => (p.id === comment.postId ? { ...p, commentCount: (p.commentCount ?? 0) + 1 } : p)),
  });
  return { ok: true, data: comment };
}

export async function removeItem(kind: 'post' | 'comment', id: string): Promise<WriteResult<null>> {
  const who = await me();
  if (!who) return { ok: false, error: SIGN_IN };
  const { data, error } = await who.client.from(kind === 'post' ? 'community_posts' : 'community_comments').delete().eq('id', id).select('id');
  if (error || !data?.length) return { ok: false, error: error ? writeErrorMessage(error) : 'You cannot remove that.' };
  if (kind === 'post') set({ posts: state.posts.filter((p) => p.id !== id), comments: state.comments.filter((c) => c.postId !== id) });
  void refreshCommunity(); // replies and counts follow
  return { ok: true, data: null };
}

/** Sets (or, with undefined, takes back) your vote on a post or comment. Shown at once, undone if refused. */
export async function castVote(kind: 'post' | 'comment', id: string, vote: Vote | undefined): Promise<WriteResult<null>> {
  const who = await me();
  if (!who) return { ok: false, error: SIGN_IN };
  const before = state.myVotes[id];
  if (before === vote) return { ok: true, data: null };

  const apply = (from: Vote | undefined, to: Vote | undefined) => {
    const myVotes = { ...state.myVotes };
    if (to) myVotes[id] = to;
    else delete myVotes[id];
    set({
      myVotes,
      posts: kind === 'post' ? state.posts.map((p) => (p.id === id ? { ...p, score: scoreAfterVote(p.score, from, to) } : p)) : state.posts,
      comments: kind === 'comment' ? state.comments.map((c) => (c.id === id ? { ...c, score: scoreAfterVote(c.score, from, to) } : c)) : state.comments,
    });
  };
  apply(before, vote);

  const column = kind === 'post' ? 'post_id' : 'comment_id';
  let error: { code?: string; message?: string } | null = null;
  if (!vote) {
    ({ error } = await who.client.from('community_votes').delete().eq('user_id', who.userId).eq(column, id));
  } else if (!before) {
    ({ error } = await who.client.from('community_votes').insert({ user_id: who.userId, [column]: id, value: vote }));
    if (error?.code === '23505') {
      // Already voted in another tab: change it instead.
      ({ error } = await who.client.from('community_votes').update({ value: vote }).eq('user_id', who.userId).eq(column, id));
    }
  } else {
    ({ error } = await who.client.from('community_votes').update({ value: vote }).eq('user_id', who.userId).eq(column, id));
  }

  if (error) {
    apply(vote, before);
    return { ok: false, error: writeErrorMessage(error) };
  }
  void refreshCommunity(); // settle on the database's totals
  return { ok: true, data: null };
}
