'use client';

import React, { useId, useState } from 'react';
import { Star } from 'lucide-react';
import { starsLabel } from '@/lib/reviews/logic';

/** Read-only stars: one image for screen readers ("4 out of 5 stars"). */
export function Stars({ rating, size = 16, className = '' }: { rating: number; size?: number; className?: string }) {
  return (
    <span role="img" aria-label={starsLabel(rating)} className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          width={size}
          height={size}
          strokeWidth={1.75}
          className={n <= rating ? 'fill-current' : 'fill-transparent opacity-35'}
        />
      ))}
    </span>
  );
}

export const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'] as const;

/**
 * Pick 1 to 5 stars. Native radio buttons underneath, so the arrow keys move
 * between stars, Tab enters and leaves the group, and touch works as a tap.
 * Hovering previews a rating without choosing it.
 */
export function StarPicker({
  value,
  onChange,
  invalid = false,
  describedBy,
}: {
  value: number;
  onChange: (rating: number) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const name = useId();
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset aria-describedby={describedBy} aria-invalid={invalid || undefined} className="min-w-0">
      <legend className="text-sm font-semibold text-ink">Your rating</legend>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex" onPointerLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(n)}
              className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-xl text-accent-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent-ink"
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="sr-only"
                aria-label={`${n} star${n === 1 ? '' : 's'}, ${RATING_WORDS[n]}`}
              />
              <Star
                aria-hidden="true"
                width={30}
                height={30}
                strokeWidth={1.6}
                className={`transition-transform duration-150 motion-reduce:transition-none ${
                  n <= shown ? 'fill-current' : 'fill-transparent text-subtle'
                } ${hover === n ? 'scale-110' : ''}`}
              />
            </label>
          ))}
        </div>
        <span aria-hidden="true" className="min-w-[6rem] text-sm text-subtle">
          {shown ? RATING_WORDS[shown] : 'Tap a star'}
        </span>
      </div>
    </fieldset>
  );
}
