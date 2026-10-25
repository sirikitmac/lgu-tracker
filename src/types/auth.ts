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
