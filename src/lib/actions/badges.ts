'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/authorize';
import { isBadgeTier, validateBadge } from '@/lib/badges/badges';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type ActionResult, toActionError } from './shared';

/**
 * Changes the label and colour of one default pill (Super Admin, Admin or
 * Government Employee) for everyone. Administrators only; the database checks
 * again (row-level security on public.role_badge_styles).
 */
export async function saveBadgeStyle(input: unknown): Promise<ActionResult<{ label: string; color: string }>> {
  try {
    await requireRole('super_admin', 'lgu_admin');
    const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
    if (!isBadgeTier(raw.tier)) return { ok: false, error: 'That kind of pill does not exist.' };
    const check = validateBadge(raw.label, raw.color);
    if (!check.ok) return { ok: false, error: check.problem.message };

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: 'Pills are not available right now.' };
    const { data, error } = await supabase
      .from('role_badge_styles')
      .update({ label: check.label, color: check.color })
      .eq('tier', raw.tier)
      .select('tier');
    if (error) return toActionError(error);
    if (!data || data.length === 0) return { ok: false, error: 'Only administrators can change these.' };

    revalidatePath('/', 'layout');
    return { ok: true, data: { label: check.label, color: check.color } };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Sets (or, with null, removes) the administrator's own custom pill. It shows
 * beside their name in place of their default one. Only for administrators, and
 * only on their own profile; the database enforces both.
 */
export async function saveMyBadge(input: unknown): Promise<ActionResult<{ label: string; color: string } | null>> {
  try {
    const me = await requireRole('super_admin', 'lgu_admin');
    let label: string | null = null;
    let color: string | null = null;
    if (input !== null) {
      const raw = (typeof input === 'object' ? input : {}) as Record<string, unknown>;
      const check = validateBadge(raw.label, raw.color);
      if (!check.ok) return { ok: false, error: check.problem.message };
      label = check.label;
      color = check.color;
    }

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: 'Pills are not available right now.' };
    const { data, error } = await supabase.from('profiles').update({ badge_label: label, badge_color: color }).eq('id', me.id).select('id');
    if (error) return toActionError(error);
    if (!data || data.length === 0) return { ok: false, error: 'Your profile could not be updated.' };

    revalidatePath('/', 'layout');
    return { ok: true, data: label && color ? { label, color } : null };
  } catch (error) {
    return toActionError(error);
  }
}
