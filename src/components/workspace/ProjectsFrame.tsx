'use client';

import React, { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { WorkspaceSidebar } from '@/components/workspace/WorkspaceSidebar';
import { useSessionRole, type SessionRole } from '@/lib/auth/useSessionRole';
import { showsProjectsSidebar } from '@/lib/nav/exploreView';

type SignedIn = Extract<SessionRole, { state: 'in' }>;

/**
 * The sidebar, unless this is the map view of /projects/map (the map keeps the
 * whole width). It reads ?view, so it sits in its own Suspense boundary: the
 * page content around it is never held back by the search params.
 */
function ProjectsSidebar({ session }: { session: SignedIn }) {
  const pathname = usePathname() ?? '';
  const view = useSearchParams()?.get('view');
  if (!showsProjectsSidebar(pathname, view)) return null;
  return (
    <div className="mb-5 lg:mb-0 lg:mr-8">
      <WorkspaceSidebar
        role={session.role}
        name={session.name}
        title={session.title}
        avatarPath={session.avatarPath}
        avatarPreset={session.avatarPreset}
      />
    </div>
  );
}

/**
 * The page frame for /projects. Visitors get the full-width content as before;
 * a signed-in person also gets the sidebar with the tabs for their role. The
 * map view keeps the whole width, because it needs the room; the dashboard
 * view keeps the sidebar.
 */
export function ProjectsFrame({ children }: { children: React.ReactNode }) {
  const session = useSessionRole();
  const signedIn = session.state === 'in';

  return (
    <div
      className={`site-frame mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 ${
        signedIn ? 'lg:grid lg:grid-cols-[auto_minmax(0,1fr)]' : ''
      }`}
    >
      {signedIn && (
        <Suspense fallback={null}>
          <ProjectsSidebar session={session} />
        </Suspense>
      )}
      {/* A page that needs the room (the map) opts into a wider frame with data-frame="wide" (see .site-frame). */}
      <main className={`min-w-0 space-y-6 ${signedIn ? 'lg:col-start-2' : ''}`}>{children}</main>
    </div>
  );
}
