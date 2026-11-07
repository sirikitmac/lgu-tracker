/**
 * Reviews of Bantay Proyekto shown on the landing page. Pure helpers only
 * (limits, validation, ordering, merging with the sample reviews), shared by
 * the review form, the server action, the live list and the tests.
 */

export const REVIEW_MIN = 10;
export const REVIEW_MAX = 500;
/** Cards in the landing grid: real reviews first, then sample ones to fill it. */
export const REVIEW_CARDS = 6;

export type ReviewStatus = 'published' | 'hidden';

/** A review someone wrote, as stored in public.reviews. */
export interface Review {
  id: string;
  userId: string;
  rating: number;
  body: string;
  /** The author's name (or first name only) and job, copied from their profile when saved. */
  displayName: string;
  jobTitle: string | null;
  avatarPath: string | null;
  avatarPreset: string | null;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

/** One of the fictional reviews shown until there are enough real ones. */
export interface SampleReview {
  id: string;
  rating: number;
  body: string;
  lang: 'tl' | 'en';
}

export type ReviewCard<S extends SampleReview = SampleReview> =
  | { kind: 'real'; key: string; review: Review }
  | { kind: 'sample'; key: string; sample: S };

/** The columns the landing page reads. */
export const REVIEW_COLUMNS =
  'id, user_id, rating, body, display_name, job_title, avatar_path, avatar_preset, status, created_at, updated_at';

/** A row from public.reviews (or a Realtime payload) to a Review; null when it is not one. */
export function reviewFromRow(row: unknown): Review | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : null);
  const id = str(r.id);
  const userId = str(r.user_id);
  const body = str(r.body);
  const createdAt = str(r.created_at);
  const rating = Number(r.rating);
  if (!id || !userId || body === null || !createdAt || !isRating(rating)) return null;
  return {
    id,
    userId,
    rating,
    body,
    displayName: str(r.display_name)?.trim() || 'Community member',
    jobTitle: str(r.job_title)?.trim() || null,
    avatarPath: str(r.avatar_path),
    avatarPreset: str(r.avatar_preset),
    status: r.status === 'hidden' ? 'hidden' : 'published',
    createdAt,
    updatedAt: str(r.updated_at) ?? createdAt,
  };
}

export const isRating = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 5;

/** Length as people count it (and as Postgres char_length does): an emoji is one, not two. */
export function charCount(text: string): number {
  return [...text].length;
}

/** Drops control characters (keeping line breaks), trims, and keeps at most one blank line in a row. */
export function tidyReview(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface ReviewInput {
  rating: number;
  body: string;
  /** Show only the first word of the profile name. */
  firstNameOnly: boolean;
}

export type ReviewCheck =
  | { ok: true; value: ReviewInput }
  | { ok: false; field: 'rating' | 'body'; error: string };

/** Checks what the form sent. Used in the form and on the server, for the same messages. */
export function validateReview(raw: unknown): ReviewCheck {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const rating = typeof input.rating === 'string' && input.rating.trim() !== '' ? Number(input.rating) : input.rating;
  if (!isRating(rating)) return { ok: false, field: 'rating', error: 'Choose a rating from 1 to 5 stars.' };

  const body = tidyReview(typeof input.body === 'string' ? input.body : '');
  const length = charCount(body);
  if (length === 0) return { ok: false, field: 'body', error: 'Write a few words about your experience.' };
  if (length < REVIEW_MIN) {
    const more = REVIEW_MIN - length;
    return { ok: false, field: 'body', error: `Write at least ${REVIEW_MIN} characters (${more} more).` };
  }
  if (length > REVIEW_MAX) {
    return { ok: false, field: 'body', error: `Keep it to ${REVIEW_MAX} characters. Remove ${length - REVIEW_MAX}.` };
  }
  return { ok: true, value: { rating, body, firstNameOnly: input.firstNameOnly === true } };
}

/** The first word of a name, for "first name only". */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/** The name a review will show, given the profile name and the author's choice. */
export function shownName(fullName: string, firstNameOnly: boolean): string {
  const tidy = fullName.trim().replace(/\s+/g, ' ') || 'Community member';
  return firstNameOnly ? firstNameOf(tidy) : tidy;
}

/** Average stars of real, published reviews, to one decimal; null when there are none. */
export function averageRating(reviews: readonly Pick<Review, 'rating' | 'status'>[]): number | null {
  const shown = reviews.filter((r) => r.status === 'published' && isRating(r.rating));
  if (shown.length === 0) return null;
  const sum = shown.reduce((total, r) => total + r.rating, 0);
  return Math.round((sum / shown.length) * 10) / 10;
}

/** Newest first; ties broken by id so the order never flickers. */
export function newestFirst<T extends Pick<Review, 'createdAt' | 'id'>>(reviews: readonly T[]): T[] {
  return [...reviews].sort((a, b) => {
    const diff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    return diff !== 0 && !Number.isNaN(diff) ? diff : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * The cards on the landing page: published real reviews (newest first), then
 * sample reviews to fill up to `size` cards. Samples never push out a real one.
 */
export function mergeReviews<S extends SampleReview>(real: readonly Review[], samples: readonly S[], size = REVIEW_CARDS): ReviewCard<S>[] {
  const cards: ReviewCard<S>[] = newestFirst(real.filter((r) => r.status === 'published'))
    .slice(0, size)
    .map((review) => ({ kind: 'real', key: `r-${review.id}`, review }));
  for (const sample of samples) {
    if (cards.length >= size) break;
    cards.push({ kind: 'sample', key: `s-${sample.id}`, sample });
  }
  return cards;
}

/** A Realtime change applied to the list of published reviews. */
export type ReviewChange =
  | { type: 'upsert'; review: Review }
  | { type: 'remove'; id: string };

export function applyChange(list: readonly Review[], change: ReviewChange): Review[] {
  if (change.type === 'remove') return list.filter((r) => r.id !== change.id);
  const rest = list.filter((r) => r.id !== change.review.id && r.userId !== change.review.userId);
  return change.review.status === 'published' ? newestFirst([change.review, ...rest]) : rest;
}

/** "4 out of 5 stars", for screen readers. */
export function starsLabel(rating: number): string {
  return `${rating} out of 5 stars`;
}
