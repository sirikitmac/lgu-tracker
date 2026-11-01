'use client';

import { createRef, useMemo } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useMedia } from './useMedia';

/**
 * "How it works": the steps stick under the navigation and stack. As the
 * next card slides over one, it settles back to 96% and dims. Sticky
 * positioning does the holding (no scroll hijacking); motion only scales
 * and fades a shade layer, both composite-only.
 *
 * Below `md` a card can be taller than the screen, so the steps simply
 * follow each other; reduced motion gets the same static list.
 */
export function StackSteps({ steps, label }: { steps: { key: string; className: string; content: React.ReactNode }[]; label: string }) {
  const reduce = useReducedMotion();
  const wide = useMedia('(min-width: 768px)');
  const refs = useMemo(() => steps.map(() => createRef<HTMLLIElement>()), [steps]);
  const animated = wide && !reduce;

  return (
    <ol className="stack" aria-label={label}>
      {steps.map((step, i) => (
        <li
          key={step.key}
          ref={refs[i]}
          className="stack-slot"
          style={{ '--stack-i': i } as React.CSSProperties}
        >
          {animated && i < steps.length - 1 ? (
            <CoveredCard next={refs[i + 1]} className={step.className}>
              {step.content}
            </CoveredCard>
          ) : (
            <div className={`stack-card ${step.className}`}>{step.content}</div>
          )}
        </li>
      ))}
    </ol>
  );
}

function CoveredCard({ next, className, children }: { next: React.RefObject<HTMLLIElement | null>; className: string; children: React.ReactNode }) {
  const { scrollYProgress } = useScroll({ target: next, offset: ['start end', 'start start'] });
  const transform = useTransform(scrollYProgress, (p) => `scale(${(1 - p * 0.04).toFixed(4)})`);
  const shade = useTransform(scrollYProgress, [0.3, 1], [0, 0.45]);
  return (
    <motion.div className={`stack-card ${className}`} style={{ transform }}>
      {children}
      <motion.span aria-hidden="true" className="stack-shade" style={{ opacity: shade }} />
    </motion.div>
  );
}

