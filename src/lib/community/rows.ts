import type { Comment, Post } from './types';

/** The columns read from public.community_posts and public.community_comments. */
export const POST_COLUMNS =
  'id, author_id, sample_author, title, body, project_title, project_code, project_href, author_name, author_title, author_avatar_path, author_avatar_preset, score, comment_count, is_sample, created_at';
export const COMMENT_COLUMNS =
  'id, post_id, parent_id, author_id, sample_author, body, author_name, author_title, author_avatar_path, author_avatar_preset, score, is_sample, created_at';

const str = (v: unknown) => (typeof v === 'string' ? v : null);

function author(r: Record<string, unknown>) {
  const sample = r.is_sample === true;
  const id = sample ? str(r.sample_author) : str(r.author_id);
  return {
    id,
    sample,
    authorName: str(r.author_name) ?? undefined,
    authorTitle: str(r.author_title),
    authorAvatarPath: str(r.author_avatar_path),
    authorAvatarPreset: str(r.author_avatar_preset),
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
  if (!id || !a.id || title === null || body === null || !createdAt) return null;
  const href = str(r.project_href);
  const projectTitle = str(r.project_title);
  return {
    id,
    authorId: a.id,
    authorName: a.authorName,
    authorTitle: a.authorTitle,
    authorAvatarPath: a.authorAvatarPath,
    authorAvatarPreset: a.authorAvatarPreset,
    sample: a.sample,
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
  if (!id || !postId || !a.id || body === null || !createdAt) return null;
  return {
    id,
    postId,
    parentId: str(r.parent_id),
    authorId: a.id,
    authorName: a.authorName,
    authorTitle: a.authorTitle,
    authorAvatarPath: a.authorAvatarPath,
    authorAvatarPreset: a.authorAvatarPreset,
    sample: a.sample,
    body,
    createdAt,
    score: Number(r.score) || 0,
  };
}

/** Puts `item` in the list by id (replacing it, or adding it), keeping the order of the rest. */
export function upsertById<T extends { id: string }>(list: readonly T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) return [item, ...list];
  const next = [...list];
  next[i] = item;
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
