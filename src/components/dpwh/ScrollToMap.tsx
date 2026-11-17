'use client';

import { useEffect } from 'react';

/** For ?view=map and ?focus= links: once the page has drawn, bring the map into view. */
export function ScrollToMap({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => {
      const el = document.getElementById('map');
      if (!el) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, 400);
    return () => window.clearTimeout(id);
  }, [active]);
  return null;
}
