import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSearch,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';
import { ProjectStatus } from '@/types/project';
import { lguStatusTone } from '@/lib/statusPalette';

interface StatusBadgeProps {
  status: ProjectStatus;
}

const ICONS: Record<ProjectStatus, LucideIcon> = {
  Completed: CheckCircle2,
  'In Progress': Clock,
  Procurement: FileSearch,
  Delayed: AlertTriangle,
  Planned: CalendarClock,
};

/**
 * Accessible status indicator pairing semantic color with an explicit icon and text label
 * so state is never communicated by hue alone. Colors come from the shared status palette.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const known = status in ICONS;
  const label = known ? status : 'Planned';
  const Icon = ICONS[label];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap"
      style={{ color: lguStatusTone(label).text }}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
