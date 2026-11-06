import React from 'react';
import { Footer } from '@/components/layout/Footer';
import { Navbar } from '@/components/layout/Navbar';

/** Frame for the community pages: the site bar, a reading column, and the footer. */
export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ground text-ink">
      <Navbar />
      <main className="site-frame mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">{children}</main>
      <Footer />
    </div>
  );
}
