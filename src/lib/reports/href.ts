import type { ReportTarget } from '@/types/report';

/** The report form for one project (the /report page). Client-safe. */
export function reportHref(target: ReportTarget | null): string {
  return target
    ? `/report?source=${encodeURIComponent(target.source)}&id=${encodeURIComponent(target.recordId)}`
    : '/report';
}
