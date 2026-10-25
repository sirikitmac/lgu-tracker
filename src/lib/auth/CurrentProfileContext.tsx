'use client';

import React, { createContext, useContext } from 'react';
import type { CurrentProfile } from '@/types/auth';

/**
 * Carries the server-verified profile (from getCurrentProfile()) into the
 * Client Component tree under src/app/dashboard. null means signed out,
 * unknown to Supabase Auth, or an inactive/missing profiles row — the
 * dashboard UI treats all three the same way (public/anonymous access).
 */
const CurrentProfileContext = createContext<CurrentProfile | null>(null);

export function CurrentProfileProvider({
  profile,
  children,
}: {
  profile: CurrentProfile | null;
  children: React.ReactNode;
}) {
  return (
    <CurrentProfileContext.Provider value={profile}>
      {children}
    </CurrentProfileContext.Provider>
  );
}

export function useCurrentProfile(): CurrentProfile | null {
  return useContext(CurrentProfileContext);
}
