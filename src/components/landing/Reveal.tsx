'use client';

import { useEffect } from 'react';

/**
 * Entrance motion for the landing page. Elements marked `data-reveal` rise in
 * once as they enter the viewport; `--reveal-delay` staggers siblings.
 *
 * Content is visible by default: nothing is hidden until this component has
 * mounted and set `reveal-ready` on <html>, so the page reads the same without
 * JavaScript, and reduced-motion visitors are never hidden from at all (CSS).
 */
export function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (!('IntersectionObserver' in window) || targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );

    // Anything already on screen shows at once; only what is below the fold waits.
    for (const el of targets) {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
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
