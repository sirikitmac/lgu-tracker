import type { SupabaseClient } from '@supabase/supabase-js';
import { LGUProject } from '@/types/project';
import { SAMPLE_LGU_PROJECTS } from '@/data/sampleProjects';
import { getSupabaseBrowserClient } from './browser';
import { isSupabaseConfigured } from './env';
import { mapProjectRow, PROJECT_SELECT, type ProjectRow } from './projectMapper';

/**
 * Client-side Supabase helpers used by the existing UI (Client Components).
 * The database schema lives in supabase/migrations; server-side code uses
 * ./server.ts and @/lib/auth/authorize instead of this module.
 */
export { isSupabaseConfigured };

export function getSupabaseClient(): SupabaseClient | null {
  return getSupabaseBrowserClient();
}

export interface ProjectsDataResult {
  projects: LGUProject[];
  isSampleData: boolean;
  errorMessage?: string;
}

/**
 * Fetches projects from Supabase when configured, or returns clearly labeled
 * development-only sample data when Supabase credentials are not yet set.
 */
export async function fetchLGUProjects(): Promise<ProjectsDataResult> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      projects: SAMPLE_LGU_PROJECTS,
      isSampleData: true,
    };
  }

  try {
    // RLS limits results to published projects (plus drafts for staff/assignees).
    const { data, error } = await client
      .from('projects')
      .select(PROJECT_SELECT)
      .order('target_completion_date', { ascending: true, nullsFirst: false });

    if (error || !data || data.length === 0) {
      if (error) {
        console.error('[LGU Tracker] Failed to load projects from Supabase:', error.message);
      }
      return {
        projects: SAMPLE_LGU_PROJECTS,
        isSampleData: true,
        errorMessage: error?.message,
      };
    }

    return {
      projects: (data as unknown as ProjectRow[]).map(mapProjectRow),
      isSampleData: false,
    };
  } catch (err) {
    return {
      projects: SAMPLE_LGU_PROJECTS,
      isSampleData: true,
      errorMessage:
        err instanceof Error ? err.message : 'Unable to query Supabase projects table.',
    };
  }
}

export interface AuthAttemptResult {
  configured: boolean;
  success: boolean;
  message: string;
  errorDetails?: string;
}

/**
 * Prepared authentication helper for LGU personnel sign-in via Supabase Auth.
 * Does not invent credentials or simulate fake backend sessions when unconfigured.
 */
export async function signInWithLGUCredentials(
  email: string,
  password: string
): Promise<AuthAttemptResult> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      configured: false,
      success: false,
      message:
        'Supabase Auth is not yet connected in this environment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to enable live LGU account authentication.',
    };
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return {
      configured: true,
      success: false,
      message:
        error?.message || 'Unable to authenticate with the provided credentials.',
      errorDetails: error?.code,
    };
  }

  return {
    configured: true,
    success: true,
    message: 'Successfully authenticated with LGU Tracker.',
  };
}

/**
 * Prepared password reset helper for Supabase Auth.
 */
export async function requestLGUPasswordReset(
  email: string
): Promise<AuthAttemptResult> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      configured: false,
      success: false,
      message:
        'Supabase Auth password recovery requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to be configured.',
    };
  }

  const { error } = await client.auth.resetPasswordForEmail(email);

  if (error) {
    return {
      configured: true,
      success: false,
      message: error.message,
    };
  }

  return {
    configured: true,
    success: true,
    message:
      'Password recovery instructions have been dispatched to your institutional email.',
  };
}
