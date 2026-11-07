'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { AppRole } from '@/types/auth';

export type SessionRole =
  | { state: 'loading' }
  | { state: 'out' }
  | {
      state: 'in';
      id: string;
      role: AppRole;
      name: string;
      /** The job title the person gave themselves, if any. */
      title: string | null;
      avatarPath: string | null;
      avatarPreset: string | null;
    };

/**
 * Who is signed in and what role they hold, for parts of public pages that
 * change when someone is signed in (the sidebar on the projects pages). Public
 * pages stay cacheable because this reads the session in the browser. It only
 * decides what to show: the pages and actions behind the tabs check the role on
 * the server, and the database enforces it.
 */
export function useSessionRole(): SessionRole {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<{ role: AppRole; name: string; title: string | null; avatarPath: string | null; avatarPreset: string | null } | null>(null);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setUserId(null);
      return;
    }
    let active = true;
    void client.auth.getSession().then(({ data }) => active && setUserId(data.session?.user.id ?? null));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id ?? null));
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !userId) {
      setProfile(null);
      return;
    }
    let active = true;
    void client
      .from('profiles')
      .select('role, full_name, is_active, position_title, avatar_path, avatar_preset')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setProfile(
          data && data.is_active
            ? {
                role: data.role as AppRole,
                name: (data.full_name as string) ?? '',
                title: (data.position_title as string | null) ?? null,
                avatarPath: (data.avatar_path as string | null) ?? null,
                avatarPreset: (data.avatar_preset as string | null) ?? null,
              }
            : null,
        );
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (userId === undefined) return { state: 'loading' };
  if (!userId) return { state: 'out' };
  return profile ? { state: 'in', id: userId, ...profile } : { state: 'loading' };
}
