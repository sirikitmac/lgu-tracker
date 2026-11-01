'use client';

import { useEffect } from 'react';

/** Start a section's entrance this far (a share of the viewport height) before it scrolls in. */
export const REVEAL_LEAD = 0.35;

/**
 * Scroll entrances for the landing page (the hero headline has its own,
 * started before first paint by HERO_PLAY_SCRIPT in page.tsx).
 *
 * Elements marked `data-reveal` rise in once, starting REVEAL_LEAD of a
 * screen before they enter the viewport; `--reveal-delay` staggers siblings.
 * Nothing is dimmed until `reveal-ready` is set here, so the page reads the
 * same without JavaScript, and reduced-motion visitors are never dimmed or
 * moved at all (CSS, and the early return below).
 */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;

    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window) || targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Also anything already above the screen (a jump to an anchor skips past it).
          if (!entry.isIntersecting && entry.boundingClientRect.bottom > 0) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: `0px 0px ${REVEAL_LEAD * 100}% 0px`, threshold: 0 }
    );

    // Anything on screen, or about to be, shows at once; only what is further down waits.
    const lead = window.innerHeight * (1 + REVEAL_LEAD);
    for (const el of targets) {
      if (el.getBoundingClientRect().top < lead) el.classList.add('is-in');
      else observer.observe(el);
    }
    root.classList.add('reveal-ready');

    return () => {
      observer.disconnect();
      root.classList.remove('reveal-ready');
    };
  }, []);

  return null;
}
