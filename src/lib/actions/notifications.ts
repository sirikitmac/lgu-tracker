'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth/authorize';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { type ActionResult, UUID_PATTERN, toActionError } from './shared';

/**
 * Inbox actions. A person can only ever touch their own notifications: the
 * database's row-level security limits every statement to rows where
 * recipient_id is the caller, and only read_at can be changed. The eq filters
 * below are for clarity, not for safety.
 */

async function client() {
  const user = await requireRole();
  const supabase = await createSupabaseServerClient();
  return supabase ? { supabase, user } : null;
}

export async function markNotificationRead(id: string): Promise<ActionResult> {
  try {
    if (!UUID_PATTERN.test(id)) return { ok: false, error: 'That notification does not exist.' };
    const ctx = await client();
    if (!ctx) return { ok: false, error: 'The inbox is not available right now.' };
    const { error } = await ctx.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('recipient_id', ctx.user.id)
      .is('read_at', null);
    if (error) return toActionError(error);
    revalidatePath('/inbox');
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  try {
    const ctx = await client();
    if (!ctx) return { ok: false, error: 'The inbox is not available right now.' };
    const { error } = await ctx.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', ctx.user.id)
      .is('read_at', null);
    if (error) return toActionError(error);
    revalidatePath('/inbox');
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  try {
    if (!UUID_PATTERN.test(id)) return { ok: false, error: 'That notification does not exist.' };
    const ctx = await client();
    if (!ctx) return { ok: false, error: 'The inbox is not available right now.' };
    const { error } = await ctx.supabase.from('notifications').delete().eq('id', id).eq('recipient_id', ctx.user.id);
    if (error) return toActionError(error);
    revalidatePath('/inbox');
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}
