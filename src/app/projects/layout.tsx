import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ProjectsFrame } from '@/components/workspace/ProjectsFrame';

/**
 * Public, sign-in-free section for DPWH project data. Nothing here reads the
 * session on the server: every query runs with the publishable key under RLS,
 * which only exposes the public DPWH source tables to anonymous visitors, so
 * the pages stay cacheable. The sidebar for signed-in people is added in the
 * browser (ProjectsFrame).
 */
export default function PublicProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink">
      <Navbar />
      <ProjectsFrame>{children}</ProjectsFrame>
      <Footer />
    </div>
  );
}
