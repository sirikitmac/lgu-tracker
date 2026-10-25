import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSearch,
  CalendarClock,
} from 'lucide-react';
import { ProjectStatus } from '@/types/project';

interface StatusBadgeProps {
  status: ProjectStatus;
}

/**
 * Accessible status indicator pairing semantic color with an explicit icon and text label
 * so state is never communicated by hue alone.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'Completed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A34A] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Completed</span>
        </span>
      );
    case 'In Progress':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>In Progress</span>
        </span>
      );
    case 'Procurement':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D97706] whitespace-nowrap">
          <FileSearch className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Procurement</span>
        </span>
      );
    case 'Delayed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DC2626] whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Delayed</span>
        </span>
      );
    case 'Planned':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] whitespace-nowrap">
          <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Planned</span>
        </span>
      );
  }
}
