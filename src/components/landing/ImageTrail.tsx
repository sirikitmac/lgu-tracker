'use client';

import { useEffect, useRef } from 'react';
import { useMedia } from './useMedia';

export interface TrailImage {
  src: string;
  srcSet?: string;
  sizes?: string;
}

/** Pointer travel between two pictures, in CSS pixels. */
const SPACING = 90;
/** Pictures on screen at once; the oldest node is reused for the next. */
const POOL = 6;
/** In, hold, out: about 700 ms in full view, then gone by 1 s. */
const DURATION = 1000;

/**
 * The closing section's cursor trail. On a fine pointer with motion allowed,
 * moving across `stage` drops project photographs at the cursor, one per
 * SPACING pixels of travel, each slightly turned; each holds for about
 * 700 ms and then shrinks away. Six <img> nodes are reused in turn, and only
 * transform and opacity animate (WAAPI, off the main thread once started).
 *
 * The pictures are fetched once the section is within 600px of the screen,
 * and a picture joins the trail only once decoded, so none pops in blank.
 *
 * Touch screens, reduced motion and no-JS get the still collage that the
 * server renders instead (globals.css hides it only where this runs).
 * Decorative: hidden from assistive technology, and never in the way of a
 * click (pointer-events: none).
 */
export function ImageTrail({ images, stageId }: { images: TrailImage[]; stageId: string }) {
  const enabled = useMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  const pool = useRef<(HTMLImageElement | null)[]>([]);

  useEffect(() => {
    const stage = document.getElementById(stageId);
    if (!enabled || !stage || images.length === 0) return;

    const ready: boolean[] = images.map(() => false);
    let fetched = false;
    const preload = () => {
      if (fetched) return;
      fetched = true;
      images.forEach((im, i) => {
        const pic = new Image();
        if (im.sizes) pic.sizes = im.sizes;
        if (im.srcSet) pic.srcset = im.srcSet;
        pic.src = im.src;
        pic.decode().then(
          () => (ready[i] = true),
          () => undefined
        );
      });
    };
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (preload(), io.disconnect()), {
      rootMargin: '600px 0px',
    });
    io.observe(stage);

    let last: { x: number; y: number } | null = null;
    let next = 0; // next picture
    let slot = 0; // next pool node
    let z = 1;

    const spawn = (x: number, y: number) => {
      // The next decoded picture, in order; none yet means no trail yet.
      let i = next;
      for (let tries = 0; tries < images.length && !ready[i]; tries++) i = (i + 1) % images.length;
      if (!ready[i]) return;
      next = (i + 1) % images.length;

      const node = pool.current[slot];
      slot = (slot + 1) % POOL;
      if (!node) return;
      for (const a of node.getAnimations()) a.cancel();
      const im = images[i];
      if (node.dataset.i !== String(i)) {
        node.dataset.i = String(i);
        node.sizes = im.sizes ?? '';
        node.srcset = im.srcSet ?? '';
        node.src = im.src;
      }
      node.style.zIndex = String(z++);
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const turn = (Math.random() * 2 - 1) * 9;
      const at = `translate3d(${(x - w / 2).toFixed(1)}px, ${(y - h / 2).toFixed(1)}px, 0) rotate(${turn.toFixed(1)}deg)`;
      node.animate(
        [
          { opacity: 0, transform: `${at} scale(0.6)` },
          { opacity: 1, transform: `${at} scale(1)`, offset: 0.14, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          { opacity: 1, transform: `${at} scale(1)`, offset: 0.7, easing: 'cubic-bezier(0.55, 0, 1, 0.45)' },
          { opacity: 0, transform: `${at} scale(0.82)` },
        ],
        { duration: DURATION, fill: 'both' }
      );
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      const r = stage.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (last && Math.hypot(x - last.x, y - last.y) < SPACING) return;
      last = { x, y };
      spawn(x, y);
    };
    const onLeave = () => {
      last = null;
    };

    stage.addEventListener('pointermove', onMove, { passive: true });
    stage.addEventListener('pointerleave', onLeave);
    return () => {
      io.disconnect();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      for (const node of pool.current) node?.getAnimations().forEach((a) => a.cancel());
    };
  }, [enabled, images, stageId]);

  if (!enabled) return null;
  return (
    <div className="trail-layer" aria-hidden="true">
      {Array.from({ length: POOL }, (_, k) => (
        <img
          key={k}
          ref={(el) => {
            pool.current[k] = el;
          }}
          alt=""
          decoding="async"
          className="trail-img"
        />
      ))}
    </div>
  );
}
