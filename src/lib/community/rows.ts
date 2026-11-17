import { isBadgeTier } from '@/lib/badges/badges';
import type { Comment, Post } from './types';

/** The columns read from public.community_posts and public.community_comments. */
export const POST_COLUMNS =
  'id, author_id, sample_author, title, body, project_title, project_code, project_href, author_name, author_title, author_avatar_path, author_avatar_preset, author_badge_tier, author_badge_label, author_badge_color, score, comment_count, is_sample, is_anonymous, created_at';
export const COMMENT_COLUMNS =
  'id, post_id, parent_id, author_id, sample_author, body, author_name, author_title, author_avatar_path, author_avatar_preset, author_badge_tier, author_badge_label, author_badge_color, score, is_sample, is_anonymous, created_at';

const str = (v: unknown) => (typeof v === 'string' ? v : null);

function author(r: Record<string, unknown>) {
  const sample = r.is_sample === true;
  const anonymous = !sample && r.is_anonymous === true;
  if (anonymous) {
    // Nothing about the author is in the row; show nothing either.
    return { id: '', ok: true, sample, anonymous, authorName: 'Anonymous', authorTitle: null, authorAvatarPath: null, authorAvatarPreset: null, authorBadgeTier: null, authorBadgeLabel: null, authorBadgeColor: null };
  }
  const id = sample ? str(r.sample_author) : str(r.author_id);
  return {
    id: id ?? '',
    ok: Boolean(id),
    sample,
    anonymous,
    authorName: str(r.author_name) ?? undefined,
    authorTitle: str(r.author_title),
    authorAvatarPath: str(r.author_avatar_path),
    authorAvatarPreset: str(r.author_avatar_preset),
    authorBadgeTier: isBadgeTier(r.author_badge_tier) ? r.author_badge_tier : null,
    authorBadgeLabel: str(r.author_badge_label),
    authorBadgeColor: str(r.author_badge_color),
  };
}

/** A database row (or a Realtime payload) to a Post; null when it is not one. */
export function postFromRow(row: unknown): Post | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const id = str(r.id);
  const title = str(r.title);
  const body = str(r.body);
  const createdAt = str(r.created_at);
  const a = author(r);
  if (!id || !a.ok || title === null || body === null || !createdAt) return null;
  const href = str(r.project_href);
  const projectTitle = str(r.project_title);
  return {
    id,
    authorId: a.id,
    authorName: a.authorName,
    authorTitle: a.authorTitle,
    authorAvatarPath: a.authorAvatarPath,
    authorAvatarPreset: a.authorAvatarPreset,
    authorBadgeTier: a.authorBadgeTier,
    authorBadgeLabel: a.authorBadgeLabel,
    authorBadgeColor: a.authorBadgeColor,
    sample: a.sample,
    ...(a.anonymous ? { anonymous: true } : {}),
    title,
    body,
    createdAt,
    score: Number(r.score) || 0,
    commentCount: Number(r.comment_count) || 0,
    project: href && projectTitle ? { title: projectTitle, href, code: str(r.project_code) ?? undefined } : undefined,
  };
}

export function commentFromRow(row: unknown): Comment | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const id = str(r.id);
  const postId = str(r.post_id);
  const body = str(r.body);
  const createdAt = str(r.created_at);
  const a = author(r);
  if (!id || !postId || !a.ok || body === null || !createdAt) return null;
  return {
    id,
    postId,
    parentId: str(r.parent_id),
    authorId: a.id,
    authorName: a.authorName,
    authorTitle: a.authorTitle,
    authorAvatarPath: a.authorAvatarPath,
    authorAvatarPreset: a.authorAvatarPreset,
    authorBadgeTier: a.authorBadgeTier,
    authorBadgeLabel: a.authorBadgeLabel,
    authorBadgeColor: a.authorBadgeColor,
    sample: a.sample,
    ...(a.anonymous ? { anonymous: true } : {}),
    body,
    createdAt,
    score: Number(r.score) || 0,
  };
}

/** A row of community_anonymous_authors, as this viewer may read it. */
export interface AnonymousAuthorRecord {
  postId: string | null;
  commentId: string | null;
  authorId: string;
  authorName: string | null;
}

export const ANONYMOUS_AUTHOR_COLUMNS = 'post_id, comment_id, author_id, author_name';

export function anonymousAuthorFromRow(row: unknown): AnonymousAuthorRecord | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const authorId = str(r.author_id);
  const postId = str(r.post_id);
  const commentId = str(r.comment_id);
  if (!authorId || (!postId && !commentId)) return null;
  return { postId, commentId, authorId, authorName: str(r.author_name) };
}

/**
 * Marks anonymous items with their real author where this viewer may know it.
 * The database only returns these records to the author (their own) and to
 * administrators (all), so nobody else ever has them to merge.
 */
export function withKnownAuthors<T extends { id: string; anonymous?: boolean; knownAuthorId?: string; knownAuthorName?: string }>(
  items: readonly T[],
  records: readonly AnonymousAuthorRecord[],
  kind: 'post' | 'comment',
): T[] {
  const byId = new Map<string, AnonymousAuthorRecord>();
  for (const r of records) {
    const id = kind === 'post' ? r.postId : r.commentId;
    if (id) byId.set(id, r);
  }
  return items.map((item) => {
    const rec = item.anonymous ? byId.get(item.id) : undefined;
    if (!rec) return item;
    return { ...item, knownAuthorId: rec.authorId, knownAuthorName: rec.authorName ?? undefined };
  });
}

/** Whether the signed-in person wrote this (named or anonymous). */
export function isOwnItem(item: { authorId: string; sample?: boolean; knownAuthorId?: string }, userId: string | null | undefined): boolean {
  if (!userId || item.sample) return false;
  return item.authorId === userId || item.knownAuthorId === userId;
}

/** Puts `item` in the list by id (replacing it, or adding it), keeping the order of the rest. */
export function upsertById<T extends { id: string; knownAuthorId?: string; knownAuthorName?: string }>(list: readonly T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [item, ...list];
  const next = [...list];
  // A live update carries no private author; keep what this viewer already knew.
  const before = list[i];
  next[i] =
    before.knownAuthorId && !item.knownAuthorId
      ? { ...item, knownAuthorId: before.knownAuthorId, knownAuthorName: before.knownAuthorName }
      : item;
  return next;
}

/** Friendly text for a failed write (rule messages from the database are already readable). */
export function writeErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return 'Something went wrong. Please try again.';
  if (error.code === 'P0001' && error.message) return error.message;
  if (error.code === '42501') return 'Your session may have ended. Please sign in again.';
  if (error.code === '23514') return 'That could not be saved. Check the length of your text.';
  if (error.code === '23503') return 'That discussion is no longer here.';
  return 'Something went wrong. Please try again.';
}
