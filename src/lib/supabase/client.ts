import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LGUProject } from '@/types/project';
import { SAMPLE_LGU_PROJECTS } from '@/data/sampleProjects';

/**
 * Supabase client configuration prepared for LGU Tracker backend and Auth connectivity.
 * Reads standard Next.js public environment variables without hardcoding any credentials.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    supabaseAnonKey.length > 20
);

/**
 * Required PostgreSQL schema migration for storing project coordinates in Supabase.
 * If the existing `projects` table does not yet include geographic coordinates,
 * run this migration in the Supabase SQL Editor.
 */
export const SUPABASE_PROJECT_MAP_SCHEMA_SQL = `
-- Add nullable geographic coordinates (WGS84) to the projects table for Project Map markers
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Optional: Add a check constraint ensuring valid latitude/longitude bounds when present
ALTER TABLE public.projects
  ADD CONSTRAINT projects_valid_coordinates_check
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  );
`.trim();

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseInstance;
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
    const { data, error } = await client
      .from('projects')
      .select('*')
      .order('targetCompletionDate', { ascending: true });

    if (error || !data || data.length === 0) {
      return {
        projects: SAMPLE_LGU_PROJECTS,
        isSampleData: true,
        errorMessage: error?.message,
      };
    }

    return {
      projects: data as LGUProject[],
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
        'Supabase Auth is not yet connected in this environment. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable live LGU account authentication.',
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
        'Supabase Auth password recovery requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be configured.',
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
