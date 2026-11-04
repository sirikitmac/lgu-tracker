import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/authorize';
import { STAFF_ROLES } from '@/types/auth';

/**
 * Where signing in goes when nothing else was asked for: LGU staff to their
 * workspace, everyone else (citizens, contractors) to the projects directory.
 * Only a convenience for where to land; the workspace checks the role again.
 */
export default async function Continue() {
  const profile = await getCurrentProfile();
  redirect(profile && STAFF_ROLES.includes(profile.role) ? '/dashboard' : '/projects');
}
