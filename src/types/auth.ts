/** Mirrors the public.app_role enum in supabase/migrations. */
export type AppRole =
  | 'super_admin'
  | 'lgu_admin'
  | 'planning_officer'
  | 'budget_officer'
  | 'bac_member'
  | 'project_engineer'
  | 'council_member'
  | 'contractor'
  | 'citizen';

export const ADMIN_ROLES: readonly AppRole[] = ['super_admin', 'lgu_admin'];

/** LGU personnel: every role except contractor and citizen. */
export const STAFF_ROLES: readonly AppRole[] = [
  'super_admin',
  'lgu_admin',
  'planning_officer',
  'budget_officer',
  'bac_member',
  'project_engineer',
  'council_member',
];

export interface CurrentProfile {
  id: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  organizationId: string | null;
}

/**
 * Roles selectable on the public Sign Up page, as a requested role only —
 * choosing one never grants it (see supabase/migrations/..._profile_requested_role.sql
 * and private.handle_new_user). super_admin is never offered here; it is
 * bootstrapped out of band, not requested through the public form.
 *
 * "Project Engineer / Inspector" and "Project Monitoring Officer" both map to
 * the single `project_engineer` role: inspector/monitor is a per-project
 * assignment (public.assignment_role), not a separate top-level app_role.
 */
export const ROLE_REQUEST_OPTIONS: ReadonlyArray<{
  value: AppRole;
  label: string;
}> = [
  { value: 'planning_officer', label: 'Planner' },
  { value: 'council_member', label: 'Development Council' },
  { value: 'budget_officer', label: 'Budget Officer' },
  { value: 'bac_member', label: 'Procurement Officer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'project_engineer', label: 'Project Engineer / Inspector' },
  { value: 'project_engineer', label: 'Project Monitoring Officer' },
  { value: 'lgu_admin', label: 'LGU Administrator' },
  { value: 'citizen', label: 'Public Viewer' },
];
