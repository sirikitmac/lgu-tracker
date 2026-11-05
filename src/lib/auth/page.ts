import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/authorize';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import type { AppRole, CurrentProfile } from '@/types/auth';

export type PageAccess =
  | { state: 'ok'; profile: CurrentProfile }
  | { state: 'forbidden'; profile: CurrentProfile }
  | { state: 'unavailable' };

/**
 * The page-level gate for the signed-in workspace pages. A visitor is sent to
 * sign in and comes back to `next`. A signed-in person without the right role
 * gets `forbidden`, so the page can say so. This is the early check; the
 * database and every Server Action check the role again.
 */
export async function pageAccess(next: string, roles: readonly AppRole[] = []): Promise<PageAccess> {
  if (!isSupabaseConfigured) return { state: 'unavailable' };
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (roles.length > 0 && !roles.includes(profile.role)) return { state: 'forbidden', profile };
  return { state: 'ok', profile };
}
