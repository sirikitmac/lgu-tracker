import React from 'react';
import { stampLabel } from '@/lib/notifications/time';
import { REPORT_STATUS_LABEL, REPORT_STATUS_MEANING, isFinalStatus, type ReportStatus } from '@/lib/reports/workflow';

export interface TimelineEvent {
  id: string;
  kind: 'submitted' | 'status_changed';
  toStatus: ReportStatus;
  note: string | null;
  createdAt: string;
  /** Who did it, already worded for the reader ("You", "LGU staff", a name). */
  actor: string;
}

/**
 * The trail of a report: every step so far, newest last, and what to expect
 * next while it is still open. The last step is marked so the current state
 * is clear at a glance.
 */
export function ReportTimeline({ events, status }: { events: TimelineEvent[]; status: ReportStatus }) {
  const done = isFinalStatus(status);
  return (
    <ol className="relative">
      {events.map((event, index) => {
        const last = index === events.length - 1;
        const current = last;
        const tone = current
          ? status === 'resolved'
            ? 'bg-emerald-600 ring-emerald-600/25 dark:bg-emerald-400 dark:ring-emerald-400/25'
            : done
              ? 'bg-muted ring-muted/25'
              : 'bg-accent ring-accent/30'
          : 'bg-surface ring-line-strong';
        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {(!last || !done) && <span aria-hidden="true" className={`absolute left-[7px] top-4 h-[calc(100%-0.5rem)] w-px ${last ? 'border-l border-dashed border-line-strong bg-transparent' : 'bg-line-strong'}`} />}
            <span aria-hidden="true" className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full ring-4 ${current ? tone : 'border-2 border-line-strong bg-surface ring-transparent'}`} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] font-semibold text-ink">
                {event.kind === 'submitted' ? 'Report sent' : REPORT_STATUS_LABEL[event.toStatus]}
                {current && <span className="text-xs font-medium text-muted">Now</span>}
              </p>
              <p className="text-[13px] text-muted">
                {event.actor} · <time dateTime={event.createdAt}>{stampLabel(event.createdAt)}</time>
              </p>
              {event.note && (
                <blockquote className="mt-2 max-w-prose whitespace-pre-line rounded-2xl rounded-tl-md bg-sunken px-4 py-3 text-[14px] leading-relaxed text-ink">
                  {event.note}
                </blockquote>
              )}
            </div>
          </li>
        );
      })}
      {!done && (
        <li className="relative flex gap-4">
          <span aria-hidden="true" className="relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-dashed border-line-strong" />
          <p className="text-[13.5px] leading-relaxed text-muted">{REPORT_STATUS_MEANING[status]}</p>
        </li>
      )}
    </ol>
  );
}
