import { ADMIN_ROLES, STAFF_ROLES, type AppRole } from '@/types/auth';

/**
 * The people-facing roles are four: Super Admin, Admin, Government Employee and
 * Citizen. Government Employee is the database's planning_officer role. The
 * other staff roles (budget, BAC, engineer, council, contractor) are no longer
 * offered; any account that still has one is shown, and works, as a
 * Government Employee.
 */
export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  lgu_admin: 'Admin',
  planning_officer: 'Government Employee',
  budget_officer: 'Government Employee',
  bac_member: 'Government Employee',
  project_engineer: 'Government Employee',
  council_member: 'Government Employee',
  contractor: 'Government Employee',
  citizen: 'Citizen',
};

const EMPLOYEE_BLURB = 'Triages reports and keeps project details accurate.';

/** One line on what each role is for; shown with the role in the sidebar and on role requests. */
export const ROLE_BLURB: Record<AppRole, string> = {
  super_admin: 'Runs the system: approves administrators and technical alerts.',
  lgu_admin: 'Approves government employees and reviews every report.',
  planning_officer: EMPLOYEE_BLURB,
  budget_officer: EMPLOYEE_BLURB,
  bac_member: EMPLOYEE_BLURB,
  project_engineer: EMPLOYEE_BLURB,
  council_member: EMPLOYEE_BLURB,
  contractor: EMPLOYEE_BLURB,
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

/** The roles offered when choosing one for an account. */
const ASSIGNABLE_ORDER: readonly AppRole[] = ['planning_officer', 'lgu_admin', 'super_admin', 'citizen'];

/**
 * Roles this administrator may give. An Admin can manage government
 * employees; only a Super Administrator can create administrators. The
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
