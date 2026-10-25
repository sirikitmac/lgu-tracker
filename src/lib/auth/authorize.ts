import 'server-only';
import { cache } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AppRole, CurrentProfile } from '@/types/auth';

export type AuthorizationErrorCode = 'NOT_CONFIGURED' | 'UNAUTHENTICATED' | 'FORBIDDEN';

export class AuthorizationError extends Error {
  constructor(public readonly code: AuthorizationErrorCode, message?: string) {
    super(
      message ??
        {
          NOT_CONFIGURED: 'Supabase is not configured in this environment.',
          UNAUTHENTICATED: 'You must be signed in to do that.',
          FORBIDDEN: 'Your account role is not allowed to do that.',
        }[code]
    );
    this.name = 'AuthorizationError';
  }
}

/**
 * The signed-in user's profile, or null when signed out or deactivated.
 *
 * Uses auth.getUser(), which verifies the session with Supabase Auth, rather
 * than trusting the cookie contents. The role is read from public.profiles,
 * never from user-editable auth metadata. Cached for the duration of a
 * single server request.
 */
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, organization_id, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    return null;
  }

  return {
    id: profile.id,
    email: user.email ?? null,
    fullName: profile.full_name,
    role: profile.role as AppRole,
    organizationId: profile.organization_id,
  };
});

/**
 * Throws an AuthorizationError unless the caller is signed in and (when
 * roles are given) holds one of them. Call it at the top of every Server
 * Action or Route Handler that changes data.
 *
 * This is an early, user-friendly check. The database enforces the same
 * rules again through RLS and guard triggers, so a bug here cannot grant
 * extra access.
 */
export async function requireRole(...roles: AppRole[]): Promise<CurrentProfile> {
  if (!isSupabaseConfigured) {
    throw new AuthorizationError('NOT_CONFIGURED');
  }

  const profile = await getCurrentProfile();
  if (!profile) {
    throw new AuthorizationError('UNAUTHENTICATED');
  }
  if (roles.length > 0 && !roles.includes(profile.role)) {
    throw new AuthorizationError('FORBIDDEN');
  }
  return profile;
}
