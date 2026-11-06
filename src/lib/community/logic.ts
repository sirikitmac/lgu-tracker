import { POST_LIMITS, type Comment, type Post, type Sort, type Vote } from './types';

/** Pressing the arrow you already pressed takes the vote back; the other arrow switches it. */
export function toggleVote(current: Vote | undefined, pressed: Vote): Vote | undefined {
  return current === pressed ? undefined : pressed;
}

/** What to show: the votes it had before you, plus yours. */
export const displayScore = (base: number, mine: Vote | undefined) => base + (mine ?? 0);

type Scored = { id: string; createdAt: string; score: number };

/** Latest first, or highest score first (newest breaks ties). */
export function sortItems<T extends Scored>(items: readonly T[], sort: Sort, votes: Record<string, Vote | undefined> = {}): T[] {
  const time = (x: T) => new Date(x.createdAt).getTime();
  const score = (x: T) => displayScore(x.score, votes[x.id]);
  return [...items].sort((a, b) => (sort === 'top' ? score(b) - score(a) || time(b) - time(a) : time(b) - time(a)));
}

export interface CommentNode {
  comment: Comment;
  depth: number;
  replies: CommentNode[];
}

/** Replies deeper than this stay at this indent, so a long chain still fits a phone. */
export const MAX_INDENT = 4;

/**
 * Turns the flat comments of one post into a tree. Top-level comments follow
 * `sort`; replies read oldest first, like a conversation. A reply whose parent
 * is missing is shown at the top level instead of being lost.
 */
export function buildThread(comments: readonly Comment[], sort: Sort, votes: Record<string, Vote | undefined> = {}): CommentNode[] {
  const ids = new Set(comments.map((c) => c.id));
  const children = new Map<string | null, Comment[]>();
  for (const c of comments) {
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : null;
    children.set(key, [...(children.get(key) ?? []), c]);
  }
  const make = (parent: string | null, depth: number): CommentNode[] => {
    const level = children.get(parent) ?? [];
    const ordered = parent === null ? sortItems(level, sort, votes) : sortItems(level, 'latest', votes).reverse();
    return ordered.map((comment) => ({ comment, depth: Math.min(depth, MAX_INDENT), replies: make(comment.id, depth + 1) }));
  };
  return make(null, 0);
}

export const commentCount = (comments: readonly Comment[], postId: string) => comments.filter((c) => c.postId === postId).length;

export type CheckResult = { ok: true } | { ok: false; field: 'title' | 'body'; error: string };

export function validatePost(input: { title: string; body: string }): CheckResult {
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < POST_LIMITS.titleMin) return { ok: false, field: 'title', error: `Give your discussion a title of at least ${POST_LIMITS.titleMin} characters.` };
  if (title.length > POST_LIMITS.titleMax) return { ok: false, field: 'title', error: `Keep the title under ${POST_LIMITS.titleMax} characters.` };
  if (body.length < POST_LIMITS.bodyMin) return { ok: false, field: 'body', error: `Tell us a little more (at least ${POST_LIMITS.bodyMin} characters).` };
  if (body.length > POST_LIMITS.bodyMax) return { ok: false, field: 'body', error: `Keep it under ${POST_LIMITS.bodyMax} characters.` };
  return { ok: true };
}

export function validateComment(text: string): { ok: true } | { ok: false; error: string } {
  const body = text.trim();
  if (!body) return { ok: false, error: 'Write something first.' };
  if (body.length > POST_LIMITS.commentMax) return { ok: false, error: `Keep it under ${POST_LIMITS.commentMax} characters.` };
  return { ok: true };
}

/** A short random id for something made in this browser. */
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
