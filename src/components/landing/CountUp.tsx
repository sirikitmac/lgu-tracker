'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 1200;
/** Strong ease-out (the --ease-out curve's shape): fast start, long settle. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
const format = new Intl.NumberFormat('en-PH');

/**
 * A live figure that counts up once, the first time it is on screen.
 *
 * The final value is rendered on the server and stays in the layout (an
 * invisible copy reserves its width, so nothing shifts), screen readers only
 * ever get the final value, and reduced-motion visitors or visitors without
 * JavaScript simply see the number.
 */
export function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    // Already on screen when the script arrives: leave the number as it is.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    let frame = 0;
    setShown(0);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          setShown(Math.round(value * easeOut(t)));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value]);

  const final = format.format(value);
  return (
    <span ref={ref} className="inline-grid tabular-nums">
      <span className="col-start-1 row-start-1 invisible" aria-hidden="true">{final}</span>
      <span className="col-start-1 row-start-1 sr-only">{final}</span>
      <span className="col-start-1 row-start-1 text-right" aria-hidden="true">{shown === null ? final : format.format(shown)}</span>
    </span>
  );
}
