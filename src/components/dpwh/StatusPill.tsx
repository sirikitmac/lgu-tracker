import React from 'react';
import { statusBadgeClass, statusColor, statusLabel } from './format';

/**
 * Reported status as a pill: the status word is always printed, and the dot
 * matches the swatch in the status chart and the map legend, so color is
 * never the only cue.
 */
export function StatusPill({ status, label, size = 'md' }: { status: string | null; label?: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border font-medium ${
        size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-xs'
      } ${statusBadgeClass(status)}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor(status) }} aria-hidden="true" />
      {label ?? statusLabel(status)}
    </span>
  );
}
