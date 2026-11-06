'use client';

import React from 'react';
import type { Sort } from '@/lib/community/types';
import { focusRing } from './parts';

const OPTIONS: { value: Sort; label: string }[] = [
  { value: 'latest', label: 'Latest' },
  { value: 'top', label: 'Top' },
];

/** Latest or Top, as two buttons that read as one control. */
export function SortTabs({ value, onChange, label }: { value: Sort; onChange: (next: Sort) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-line bg-surface p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`h-8 rounded-full px-4 text-[13px] font-semibold transition-colors ${focusRing} ${
            value === o.value ? 'bg-ink text-on-ink' : 'text-subtle hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
