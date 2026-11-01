'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useMedia } from './useMedia';

/**
 * One card of the "what you can do" grid. As it scrolls into view it turns
 * in on a shallow 3D arc: the outer columns swing in from their side, the
 * middle one comes forward. Progress is the card's own scroll position, so
 * scrolling stays the browser's; the card is flat (and fully usable) once it
 * is a quarter of the way up the screen, and never dimmer than 70%.
 *
 * Phones and tablets get a plain rise; reduced motion, and the prerendered
 * HTML before scripts run, get the card standing still.
 */
export function ArcItem({ index, children, className = '' }: { index: number; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLLIElement>(null);
  // False on the server and during hydration, so the prerendered card is in its final, flat state.
  const animate = useMedia('(prefers-reduced-motion: no-preference)');
  const wide = useMedia('(min-width: 1024px)');
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'start 0.75'] });

  // -1, 0, 1: left, middle, right column of the three-column grid.
  const side = (index % 3) - 1;
  const transform = useTransform(scrollYProgress, (p) => {
    const q = 1 - p;
    if (!wide) return `translate3d(0, ${(q * 16).toFixed(2)}px, 0)`;
    return `perspective(1200px) translate3d(${(side * q * 28).toFixed(2)}px, ${(q * 24).toFixed(2)}px, ${(-q * 90).toFixed(2)}px) rotateY(${(-side * q * 12).toFixed(2)}deg) rotateX(${(q * 4).toFixed(2)}deg)`;
  });
  const opacity = useTransform(scrollYProgress, [0, 0.5], [0.7, 1]);

  // The ref stays attached either way: useScroll needs a hydrated target.
  if (!animate)
    return (
      <li ref={ref} className={className}>
        {children}
      </li>
    );
  return (
    <motion.li ref={ref} className={`${className} arc-item`} style={{ transform, opacity }}>
      {children}
    </motion.li>
  );
}
