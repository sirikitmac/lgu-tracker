import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

/**
 * Public, sign-in-free section for DPWH project data. Nothing here reads the
 * session or the profile: every query runs with the publishable key under
 * RLS, which only exposes the public DPWH source tables to anonymous visitors.
 */
export default function PublicProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink">
      <Navbar />
      {/* A page that needs the room (the map) opts into a wider frame with data-frame="wide" (see .site-frame). */}
      <main className="site-frame flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">{children}</main>
      <Footer />
    </div>
  );
}
