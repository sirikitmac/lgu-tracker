import React from 'react';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';
import { WorkspaceSidebar } from '@/components/workspace/WorkspaceSidebar';
import { getCurrentProfile } from '@/lib/auth/authorize';

/**
 * The signed-in area: the inbox, your reports, the report queue and user
 * management, with the sidebar of tabs for the person's role. Each page checks
 * access itself (src/lib/auth/page.ts); this layout only draws the frame.
 */
export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();

  return (
    <div className="flex min-h-screen flex-col bg-ground text-ink">
      <Navbar />
      <div className="site-frame mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-8 lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10">
        {profile && <WorkspaceSidebar role={profile.role} name={profile.fullName} />}
        <main className="mt-5 min-w-0 lg:mt-0">{children}</main>
      </div>
      <Footer />
    </div>
  );
}
