import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LockKeyhole } from 'lucide-react';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { getCurrentProfile } from '@/lib/auth/authorize';
import { signOutAction } from '@/lib/actions/auth';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { STAFF_ROLES } from '@/types/auth';

export const metadata: Metadata = {
  title: 'Monitoring workspace | LGU Tracker',
  robots: { index: false },
};

/**
 * The monitoring workspace is for LGU staff. A visitor is sent to sign in and
 * comes back here; a signed-in citizen or contractor is told it is staff-only.
 * The public views live in the projects directory (/projects), so the old
 * "public mode" of this page goes there.
 *
 * This is the early check; the data underneath is protected by RLS and every
 * Server Action checks the role again (src/lib/auth/authorize.ts).
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mode } = await searchParams;
  if (mode === 'public') redirect('/projects');

  // Without Supabase (a local run with no .env) there are no accounts to check; sample data only.
  const preview = !isSupabaseConfigured && process.env.NODE_ENV !== 'production';
  if (!preview) {
    const profile = await getCurrentProfile();
    if (!profile) redirect(`/login?next=${encodeURIComponent('/dashboard')}`);
    if (!STAFF_ROLES.includes(profile.role)) return <StaffOnly name={profile.fullName} />;
  }

  return <DashboardOverview />;
}

function StaffOnly({ name }: { name: string }) {
  const link =
    'inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink';
  return (
    <main className="min-h-screen grid place-items-center bg-ground px-4 text-ink">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-7 text-center shadow-float">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sunken">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight">This workspace is for LGU staff</h1>
        <p className="mt-2 text-sm leading-relaxed text-subtle">
          {name}, your account can browse every project and send reports, but the monitoring workspace is
          turned on by an LGU Administrator for staff accounts.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/projects" className={`${link} bg-ink text-on-ink hover:bg-ink-soft`}>
            Browse projects
          </Link>
          <form action={signOutAction}>
            <button type="submit" className={`${link} w-full cursor-pointer border border-line-strong bg-surface hover:bg-sunken`}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
