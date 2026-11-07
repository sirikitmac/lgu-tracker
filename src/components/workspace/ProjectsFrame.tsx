'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { WorkspaceSidebar } from '@/components/workspace/WorkspaceSidebar';
import { useSessionRole } from '@/lib/auth/useSessionRole';

/**
 * The page frame for /projects. Visitors get the full-width content as before;
 * a signed-in person also gets the sidebar with the tabs for their role. The
 * map keeps the whole width, because it needs the room.
 */
export function ProjectsFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const session = useSessionRole();
  const showSidebar = session.state === 'in' && !pathname.startsWith('/projects/map');

  return (
    <div
      className={`site-frame mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 ${
        showSidebar ? 'lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-10' : ''
      }`}
    >
      {showSidebar && session.state === 'in' && (
        <WorkspaceSidebar
          role={session.role}
          name={session.name}
          title={session.title}
          avatarPath={session.avatarPath}
          avatarPreset={session.avatarPreset}
        />
      )}
      {/* A page that needs the room (the map) opts into a wider frame with data-frame="wide" (see .site-frame). */}
      <main className={`min-w-0 space-y-6 ${showSidebar ? 'mt-5 lg:mt-0' : ''}`}>{children}</main>
    </div>
  );
}
