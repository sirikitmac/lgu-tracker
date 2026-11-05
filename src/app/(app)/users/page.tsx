import type { Metadata } from 'next';
import { RoleDesk, type Person } from '@/components/users/RoleDesk';
import { PageHeader } from '@/components/workspace/PageHeader';
import { NoAccess, NotAvailable } from '@/components/workspace/PageStates';
import { pageAccess } from '@/lib/auth/page';
import { ADMIN_ROLES, isAccountType, DEFAULT_ACCOUNT_TYPE, type AppRole } from '@/types/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Users and roles | LGU Tracker', robots: { index: false } };

const ROLES: readonly string[] = [
  'super_admin', 'lgu_admin', 'planning_officer', 'budget_officer', 'bac_member',
  'project_engineer', 'council_member', 'contractor', 'citizen',
];
const asRole = (v: unknown): AppRole | null => (typeof v === 'string' && ROLES.includes(v) ? (v as AppRole) : null);

export default async function UsersPage() {
  const access = await pageAccess('/users', ADMIN_ROLES);
  if (access.state === 'unavailable') return <NotAvailable />;
  if (access.state === 'forbidden') return <NoAccess what="Users and roles" />;

  const supabase = await createSupabaseServerClient();
  const { data, error } = supabase
    ? await supabase
        .from('profiles')
        .select('id, full_name, role, requested_role, account_type, claimed_organization, position_title, created_at, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(500)
    : { data: null, error: new Error('not configured') };

  const people: Person[] = (data ?? []).flatMap((row) => {
    const role = asRole(row.role);
    if (!role) return [];
    return [
      {
        id: row.id as string,
        name: ((row.full_name as string) ?? '').trim(),
        role,
        requestedRole: asRole(row.requested_role),
        accountType: isAccountType(row.account_type) ? row.account_type : DEFAULT_ACCOUNT_TYPE,
        organization: (row.claimed_organization as string | null) ?? null,
        position: (row.position_title as string | null) ?? null,
        createdAt: row.created_at as string,
      },
    ];
  });

  // Waiting: still a citizen, but asked for a role or signed up as an organization or technical account.
  const pending = people.filter(
    (p) => p.role === 'citizen' && (p.requestedRole !== null || p.accountType !== 'citizen')
  );
  const members = people.filter((p) => p.role !== 'citizen');

  return (
    <>
      <PageHeader
        title="Users and roles"
        description="Everyone starts as a citizen. People who ask for a role at sign-up wait here until an administrator decides."
      />
      {error ? (
        <NotAvailable title="Accounts did not load" description="Refresh the page. If it keeps happening, try again in a few minutes." />
      ) : (
        <RoleDesk pending={pending} members={members} actor={access.profile.role} actorId={access.profile.id} />
      )}
    </>
  );
}
