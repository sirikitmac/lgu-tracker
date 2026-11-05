import { ADMIN_ROLES, STAFF_ROLES, type AppRole } from '@/types/auth';

/** Plain names for roles, the same wording the database uses in notifications. */
export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: 'Super Administrator',
  lgu_admin: 'LGU Administrator',
  planning_officer: 'Planning Officer',
  budget_officer: 'Budget Officer',
  bac_member: 'BAC Member',
  project_engineer: 'Project Engineer',
  council_member: 'Council Member',
  contractor: 'Contractor',
  citizen: 'Citizen',
};

/** One line on what each role is for; shown with the role in the sidebar and on role requests. */
export const ROLE_BLURB: Record<AppRole, string> = {
  super_admin: 'Runs the system: approves administrators and technical alerts.',
  lgu_admin: 'Approves staff roles and reviews every report.',
  planning_officer: 'Triages reports and keeps project details accurate.',
  budget_officer: 'Updates project budgets and disbursements.',
  bac_member: 'Records procurement mode and awarded contractors.',
  project_engineer: 'Updates progress and reviews reports on assigned projects.',
  council_member: 'Follows projects and decides proposals when authorized.',
  contractor: 'Follows the projects assigned to your company.',
  citizen: 'Browse every project and send reports.',
};

/**
 * Roles that can open the report queue. Mirrors private.can_handle_report in
 * the database: administrators, planning officers, and project engineers (for
 * the projects they are assigned to). Budget, BAC and council roles get no
 * access to private concerns.
 */
export const REPORT_HANDLER_ROLES: readonly AppRole[] = [
  'super_admin',
  'lgu_admin',
  'planning_officer',
  'project_engineer',
];

export const canReviewReports = (role: AppRole) => REPORT_HANDLER_ROLES.includes(role);
export const canManageUsers = (role: AppRole) => ADMIN_ROLES.includes(role);
export const isStaffRole = (role: AppRole) => STAFF_ROLES.includes(role);
export const isAdminRole = (role: AppRole) => ADMIN_ROLES.includes(role);

/** Order used when listing roles to choose from. */
const ASSIGNABLE_ORDER: readonly AppRole[] = [
  'planning_officer',
  'budget_officer',
  'bac_member',
  'project_engineer',
  'council_member',
  'contractor',
  'lgu_admin',
  'super_admin',
  'citizen',
];

/**
 * Roles this administrator may give. An LGU Administrator can manage staff
 * and contractors; only a Super Administrator can create administrators. The
 * database enforces the same rule (private.guard_profile_update).
 */
export function assignableRoles(actor: AppRole): AppRole[] {
  if (!canManageUsers(actor)) return [];
  return ASSIGNABLE_ORDER.filter((role) => actor === 'super_admin' || !isAdminRole(role));
}

/** Whether `actor` may change the role of an account that currently has `target`. */
export function canChangeRoleOf(actor: AppRole, target: AppRole): boolean {
  if (!canManageUsers(actor)) return false;
  return actor === 'super_admin' || !isAdminRole(target);
}
