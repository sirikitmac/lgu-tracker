'use server';

import { requireRole } from '@/lib/auth/authorize';
import { REVIEW_COLUMNS, reviewFromRow, shownName, validateReview, type Review, type ReviewStatus } from '@/lib/reviews/logic';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type ActionResult, UUID_PATTERN, toActionError } from './shared';

/**
 * Reviews on the landing page. Anyone signed in has at most one review; they
 * can write it, change it or delete it. Administrators can hide or show any.
 *
 * The database is the real gate (RLS and private.guard_review_write, which
 * also copies the author's name, job and picture from their own profile).
 * The checks here give friendly answers first.
 */

function reviewError(error: unknown): { ok: false; error: string } {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
  if (code === '23514') return { ok: false, error: 'That review could not be saved. Check the stars and the length of the text.' };
  if (code === '23505') return { ok: false, error: 'You already have a review. Reload the page to edit it.' };
  return toActionError(error);
}

/** Writes my review, or updates it if I already have one. */
export async function saveMyReview(input: unknown): Promise<ActionResult<Review>> {
  try {
    const me = await requireRole();
    const check = validateReview(input);
    if (!check.ok) return { ok: false, error: check.error };
    const { rating, body, firstNameOnly } = check.value;

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: 'Reviews are not available right now.' };

    // How I appear right now, copied onto the review (profiles are not public).
    const snapshot = {
      rating,
      body,
      display_name: shownName(me.fullName, firstNameOnly),
      job_title: me.positionTitle?.trim() || null,
      avatar_path: me.avatarPath,
      avatar_preset: me.avatarPath ? null : me.avatarPreset,
    };

    const { data: existing, error: findError } = await supabase.from('reviews').select('id').eq('user_id', me.id).maybeSingle();
    if (findError) return reviewError(findError);

    const query = existing
      ? supabase.from('reviews').update(snapshot).eq('id', existing.id)
      : supabase.from('reviews').insert({ ...snapshot, user_id: me.id });
    const { data, error } = await query.select(REVIEW_COLUMNS).maybeSingle();
    if (error) return reviewError(error);
    const saved = reviewFromRow(data);
    if (!saved) return { ok: false, error: 'Your review could not be saved.' };
    return { ok: true, data: saved };
  } catch (error) {
    return reviewError(error);
  }
}

/** Deletes my review. */
export async function deleteMyReview(): Promise<ActionResult<{ id: string | null }>> {
  try {
    const me = await requireRole();
    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: 'Reviews are not available right now.' };
    const { data, error } = await supabase.from('reviews').delete().eq('user_id', me.id).select('id');
    if (error) return reviewError(error);
    return { ok: true, data: { id: (data?.[0]?.id as string | undefined) ?? null } };
  } catch (error) {
    return reviewError(error);
  }
}

/** Administrators: hide a review from everyone, or show it again. */
export async function setReviewStatus(id: unknown, status: unknown): Promise<ActionResult<Review>> {
  try {
    await requireRole('lgu_admin', 'super_admin');
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return { ok: false, error: 'That review could not be found.' };
    if (status !== 'published' && status !== 'hidden') return { ok: false, error: 'Choose hide or show.' };

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: 'Reviews are not available right now.' };
    const { data, error } = await supabase
      .from('reviews')
      .update({ status: status satisfies ReviewStatus })
      .eq('id', id)
      .select(REVIEW_COLUMNS)
      .maybeSingle();
    if (error) return reviewError(error);
    const saved = reviewFromRow(data);
    if (!saved) return { ok: false, error: 'That review could not be found.' };
    return { ok: true, data: saved };
  } catch (error) {
    return reviewError(error);
  }
}
