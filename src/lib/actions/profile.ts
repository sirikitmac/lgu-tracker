'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/authorize';
import { validateProfile, type ProfileInput } from '@/lib/profile/avatars';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type ActionResult, toActionError } from './shared';

/**
 * Saves how the signed-in person appears: name, job title and picture (an
 * uploaded photo or a free avatar). Anyone signed in can change their own.
 * The database is the real gate: a person can only update their own row, can
 * only point a photo at their own folder, and role and account type stay
 * locked (private.guard_profile_update). The checks here make the answer friendly.
 */
export async function updateProfile(input: unknown): Promise<ActionResult<ProfileInput>> {
  try {
    const me = await requireRole();
    const check = validateProfile(input, me.id);
    if (!check.ok) return { ok: false, error: check.error };
    const { fullName, positionTitle, avatarPath, avatarPreset } = check.value;

    const supabase = await createSupabaseServerClient();
    if (!supabase) return { ok: false, error: 'Profiles are not available right now.' };

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        position_title: positionTitle || null,
        avatar_path: avatarPath,
        avatar_preset: avatarPreset,
      })
      .eq('id', me.id)
      .select('id');
    if (error) return toActionError(error);
    if (!data || data.length === 0) return { ok: false, error: 'Your profile could not be updated.' };

    // The name, job and picture show in the sidebar of every signed-in page.
    revalidatePath('/', 'layout');
    return { ok: true, data: check.value };
  } catch (error) {
    return toActionError(error);
  }
}
