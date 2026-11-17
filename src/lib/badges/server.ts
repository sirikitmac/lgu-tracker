import 'server-only';
import { cache } from 'react';
import { DEFAULT_BADGE_STYLES, stylesFromRows, type BadgeStyles } from '@/lib/badges/badges';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** The current pill styles (defaults when the table cannot be read). Cached for one request. */
export const getBadgeStyles = cache(async (): Promise<BadgeStyles> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return DEFAULT_BADGE_STYLES;
  const { data } = await supabase.from('role_badge_styles').select('tier, label, color');
  return stylesFromRows(data);
});
