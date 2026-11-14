'use client';

import { useEffect } from 'react';

/**
 * Brings the map section into view once, for links that point at one project
 * (?focus=, ?code=) and would otherwise open on the dashboard above it.
 */
export function ScrollToMap() {
  useEffect(() => {
    document.getElementById('map')?.scrollIntoView({ block: 'start' });
  }, []);
  return null;
}
