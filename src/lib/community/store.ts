'use client';

import { useSyncExternalStore } from 'react';
import { MOCK_COMMENTS, MOCK_POSTS } from './mock';
import type { Comment, Post, Vote } from './types';

/**
 * Where the community keeps what you do while it runs on sample data: posts
 * and comments you write and your votes, saved in this browser only (nobody
 * else sees them). The sample discussions are always shown with them. When
 * the community moves to the database, this is the part that gets replaced.
 */
interface Saved {
  posts: Post[];
  comments: Comment[];
  /** Votes by account, then by post or comment id. */
  votes: Record<string, Record<string, Vote>>;
}

const KEY = 'bp-community-v1';
const EMPTY: Saved = { posts: [], comments: [], votes: {} };

export interface CommunityState extends Saved {
  allPosts: Post[];
  allComments: Comment[];
}

let saved: Saved = EMPTY;
let loaded = false;
let snapshot: CommunityState = build(EMPTY);
const listeners = new Set<() => void>();

function build(s: Saved): CommunityState {
  return { ...s, allPosts: [...s.posts, ...MOCK_POSTS], allComments: [...s.comments, ...MOCK_COMMENTS] };
}

function read(): Saved {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Saved>;
    return {
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      votes: parsed.votes && typeof parsed.votes === 'object' ? parsed.votes : {},
    };
  } catch {
    return EMPTY; // private window or damaged data: start empty, nothing breaks
  }
}

function publish(next: Saved) {
  saved = next;
  snapshot = build(next);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the change still shows until the page closes */
  }
  listeners.forEach((l) => l());
}

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  saved = read();
  snapshot = build(saved);
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    saved = read();
    snapshot = build(saved);
    listeners.forEach((l) => l());
  });
}

const subscribe = (listener: () => void) => {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const serverSnapshot = build(EMPTY);

/** The community's posts, comments and votes. Sample content only until the browser has loaded. */
export function useCommunity(): CommunityState {
  return useSyncExternalStore(
    subscribe,
    () => {
      ensureLoaded();
      return snapshot;
    },
    () => serverSnapshot,
  );
}

export const addPost = (post: Post) => publish({ ...saved, posts: [post, ...saved.posts] });
export const addComment = (comment: Comment) => publish({ ...saved, comments: [...saved.comments, comment] });

export function setVote(userId: string, targetId: string, vote: Vote | undefined) {
  const mine = { ...(saved.votes[userId] ?? {}) };
  if (vote) mine[targetId] = vote;
  else delete mine[targetId];
  publish({ ...saved, votes: { ...saved.votes, [userId]: mine } });
}
