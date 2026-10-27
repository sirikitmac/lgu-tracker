import React from 'react';
import { AlertTriangle, Info, Loader2, RotateCcw, SearchX, type LucideIcon } from 'lucide-react';
import { secondaryButtonSmClass } from '@/components/dpwh/ui';

/**
 * The three non-content states every data view can be in, drawn one way
 * across the app:
 *
 * - Skeleton: the request is in flight. Shapes only, hidden from assistive
 *   technology (the surrounding region carries aria-busy or a status line).
 * - EmptyState: the request succeeded and there is nothing to show.
 * - ErrorState: the request failed. Never shown as an empty result.
 *
 * Notice is the slim banner for page-level conditions (a summary that did
 * not load, data not imported yet) that sit above working content.
 */

/** A grey placeholder bar or block. Give it a size; it pulses unless reduced motion is on. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`block bg-sunken rounded-full motion-safe:animate-pulse ${className}`} />;
}

interface StateProps {
  title: string;
  description?: React.ReactNode;
  /** Smaller padding and type for panels and chart areas. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  action,
  compact = false,
  className = '',
}: StateProps & { icon?: LucideIcon; action?: React.ReactNode }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-12'} ${className}`}>
      <span className={`grid place-items-center rounded-full bg-sunken ${compact ? 'w-9 h-9' : 'w-11 h-11'}`}>
        <Icon className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-muted`} aria-hidden="true" />
      </span>
      <p className={`${compact ? 'text-sm' : 'text-[15px]'} font-semibold text-ink`}>{title}</p>
      {description && <p className="max-w-sm text-[13px] leading-relaxed text-subtle">{description}</p>}
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  retrying = false,
  children,
  compact = false,
  className = '',
}: StateProps & { onRetry?: () => void; retrying?: boolean; children?: React.ReactNode }) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center text-center ${compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-12'} ${className}`}>
      <span className={`grid place-items-center rounded-full bg-danger-soft ${compact ? 'w-9 h-9' : 'w-11 h-11'}`}>
        <AlertTriangle className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-danger-ink`} aria-hidden="true" />
      </span>
      <p className={`${compact ? 'text-sm' : 'text-[15px]'} font-semibold text-ink`}>{title}</p>
      {description && <p className="max-w-sm text-[13px] leading-relaxed text-subtle">{description}</p>}
      {children}
      {onRetry && (
        <button type="button" onClick={onRetry} disabled={retrying} className={`${secondaryButtonSmClass} mt-1`}>
          {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />}
          {retrying ? 'Trying again…' : 'Try again'}
        </button>
      )}
    </div>
  );
}

const NOTICE_TONES = {
  danger: { box: 'border-danger-line bg-danger-soft text-danger-ink', Icon: AlertTriangle, role: 'alert' },
  warn: { box: 'border-warn-line bg-warn-soft text-warn-ink', Icon: AlertTriangle, role: 'status' },
  info: { box: 'border-line bg-sunken text-subtle', Icon: Info, role: 'status' },
} as const;

/** A one-line banner above content. Danger is announced as an alert; the others politely. */
export function Notice({
  tone,
  children,
  action,
  className = '',
}: {
  tone: keyof typeof NOTICE_TONES;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { box, Icon, role } = NOTICE_TONES[tone];
  return (
    <div role={role} className={`flex flex-wrap items-start gap-x-3 gap-y-2 p-3.5 rounded-card border text-[13px] leading-relaxed ${box} ${className}`}>
      <span className="flex items-start gap-2 min-w-0 flex-1">
        <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span className="min-w-0">{children}</span>
      </span>
      {action}
    </div>
  );
}
