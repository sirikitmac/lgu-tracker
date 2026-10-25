'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Signs the current user out of Supabase Auth (clearing the session cookies
 * through the same cookie adapter used by createSupabaseServerClient) and
 * returns them to the public landing page.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect('/');
}
