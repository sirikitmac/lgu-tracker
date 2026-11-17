'use client';

import { useEffect } from 'react';

/** For ?view=dashboard links: once the page has drawn, bring the dashboard into view. */
export function ScrollToDashboard({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const id = window.setTimeout(() => {
      const el = document.getElementById('dashboard');
      if (!el) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }, 400);
    return () => window.clearTimeout(id);
  }, [active]);
  return null;
}
