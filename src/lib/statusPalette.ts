import type { ProjectStatus } from '@/types/project';

/**
 * The one set of status colors used across the app. DPWH/NEP statuses
 * (src/components/dpwh/format.ts) and LGU project statuses
 * (src/components/ui/StatusBadge.tsx, src/components/map/IliganProjectMap.tsx)
 * each map to a tone here, so the same meaning gets the same color everywhere.
 *
 * - fill: map markers, legend swatches, progress bars.
 * - text: status text on white (at least 4.5:1 contrast; fills like amber
 *   #F59E0B are too light for text).
 * - badge: Tailwind classes for pill badges (kept as literals so Tailwind
 *   picks them up).
 */
export const STATUS_TONES = {
  green: { fill: '#16A34A', text: '#15803D', badge: 'bg-green-50 text-green-800 border-green-200' },
  blue: { fill: '#2563EB', text: '#1D4ED8', badge: 'bg-blue-50 text-blue-800 border-blue-200' },
  orange: { fill: '#F59E0B', text: '#B45309', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
  gray: { fill: '#64748B', text: '#475569', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  red: { fill: '#DC2626', text: '#B91C1C', badge: 'bg-red-50 text-red-800 border-red-200' },
  // Dashed and lighter so "no status reported" never reads as "Not yet started".
  lightGray: { fill: '#94A3B8', text: '#64748B', badge: 'bg-white text-slate-500 border-slate-300 border-dashed' },
  purple: { fill: '#7C3AED', text: '#6D28D9', badge: 'bg-violet-50 text-violet-800 border-violet-200' },
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

/**
 * LGU-entered project statuses (public.project_status). Planned shares gray
 * with DPWH "Not yet started"; Procurement shares orange with "For
 * procurement". Delayed is red, like Terminated: both need attention.
 */
export const LGU_STATUS_TONE: Record<ProjectStatus, StatusTone> = {
  Completed: 'green',
  'In Progress': 'blue',
  Procurement: 'orange',
  Planned: 'gray',
  Delayed: 'red',
};

export function lguStatusTone(status: ProjectStatus) {
  return STATUS_TONES[LGU_STATUS_TONE[status] ?? 'lightGray'];
}
