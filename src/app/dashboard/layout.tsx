import React from 'react';
import { getCurrentProfile } from '@/lib/auth/authorize';
import { CurrentProfileProvider } from '@/lib/auth/CurrentProfileContext';

/**
 * Server Component boundary for every /dashboard route. Resolves the
 * signed-in user's verified profile and role exactly once per request (via
 * getCurrentProfile(), which calls supabase.auth.getUser() rather than
 * trusting cookies) and hands it to the client dashboard through context.
 * Anonymous visitors, and signed-in users without an active profiles row,
 * both resolve to `null` and see the public-facing navigation only.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <CurrentProfileProvider profile={profile}>
      {children}
    </CurrentProfileProvider>
  );
}
