'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

/**
 * App-wide toasts: short confirmations that an action finished (or failed)
 * when the result is not otherwise visible where the person is looking.
 * Not for validation errors (those belong beside the field) and not for
 * ordinary navigation.
 *
 * - One stack, bottom-left on wide screens (clear of BP, bottom-right) and
 *   full-width at the bottom on phones; at most three at once.
 * - Calling toast() with an id that is already showing updates that toast
 *   and restarts its timer instead of stacking a copy. Without an id, the
 *   same tone + title + description counts as the same toast.
 * - Timers pause while the pointer or keyboard focus is in the stack.
 * - Screen readers hear success and info politely, warnings and errors
 *   assertively, through live regions that are always in the page.
 */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  /** Stable key for an event that can repeat (e.g. "network", "dpwh-sync"). */
  id?: string;
  tone?: ToastTone;
  title: string;
  description?: string;
  /** Milliseconds before it closes itself; 0 keeps it until dismissed. Defaults by tone. */
  duration?: number;
}

interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  duration: number;
  /** Bumped when an existing toast is updated, to restart its timer and re-announce it. */
  version: number;
  leaving: boolean;
}

interface ToastApi {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const DEFAULT_DURATION: Record<ToastTone, number> = { success: 5000, info: 5000, warning: 8000, error: 10000 };
const MAX_VISIBLE = 3;
const EXIT_MS = 160;
/** A paused toast gets at least this long to be read once the pointer leaves. */
const MIN_RESUME_MS = 1500;

const TONES: Record<ToastTone, { Icon: typeof Info; icon: string; label: string }> = {
  success: { Icon: CheckCircle2, icon: 'text-[#16A34A] dark:text-[#4ADE80]', label: 'Success' },
  error: { Icon: XCircle, icon: 'text-danger-ink', label: 'Error' },
  warning: { Icon: AlertTriangle, icon: 'text-warn-ink', label: 'Warning' },
  info: { Icon: Info, icon: 'text-muted', label: 'Notice' },
};

const ToastContext = createContext<ToastApi | null>(null);

/** toast({ tone, title, description }) from any Client Component under the root layout. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>.');
  return api;
}

function ToastCard({ item, paused, onDismiss }: { item: ToastItem; paused: boolean; onDismiss: (id: string) => void }) {
  const remaining = useRef(item.duration);
  // Runs before the timer effect below, so an update starts a full new countdown.
  useEffect(() => {
    remaining.current = item.duration;
  }, [item.version, item.duration]);
  useEffect(() => {
    if (paused || item.leaving || item.duration === 0) return;
    const started = Date.now();
    // A fresh toast runs its full time; one resuming after a pause gets at least MIN_RESUME_MS.
    const wait = remaining.current < item.duration ? Math.max(remaining.current, MIN_RESUME_MS) : item.duration;
    const timer = setTimeout(() => onDismiss(item.id), wait);
    return () => {
      clearTimeout(timer);
      remaining.current = wait - (Date.now() - started);
    };
  }, [paused, item.leaving, item.duration, item.version, item.id, onDismiss]);

  const { Icon, icon, label } = TONES[item.tone];
  return (
    <li
      className={`pointer-events-auto w-full sm:w-[23rem] flex items-start gap-3 pl-3.5 pr-2 py-3 rounded-2xl bg-raised border border-line shadow-float ${
        item.leaving ? 'motion-safe:animate-[toast-out_160ms_ease-in_forwards]' : 'motion-safe:animate-[toast-in_220ms_var(--ease-out)]'
      }`}
    >
      <Icon className={`w-[18px] h-[18px] mt-px shrink-0 ${icon}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 pt-px">
        <p className="text-[13.5px] font-semibold leading-snug text-ink break-words">
          <span className="sr-only">{label}: </span>
          {item.title}
        </p>
        {item.description && <p className="mt-0.5 text-[13px] leading-snug text-subtle break-words">{item.description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label={`Dismiss notification: ${item.title}`}
        className="grid place-items-center w-8 h-8 -my-1 shrink-0 rounded-full text-muted hover:text-ink hover:bg-sunken transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-ink"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Warns once when the browser loses its connection and says so when it is
 * back, so a failing search or map is not mistaken for missing data.
 */
function ConnectionNotices({ toast, dismiss }: ToastApi) {
  useEffect(() => {
    let wentOffline = false;
    const offline = () => {
      wentOffline = true;
      toast({ id: 'network', tone: 'warning', title: 'You are offline', description: 'Searches and the map will not update until the connection returns.', duration: 0 });
    };
    const online = () => {
      if (!wentOffline) return;
      wentOffline = false;
      dismiss('network');
      toast({ id: 'network-restored', tone: 'success', title: 'Back online' });
    };
    if (!navigator.onLine) offline();
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [toast, dismiss]);
  return null;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [announcement, setAnnouncement] = useState<{ key: number; text: string; urgent: boolean } | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const counter = useRef(0);
  const stackRef = useRef<HTMLElement>(null);

  // A toast removed under the pointer or with focus inside fires no leave/blur; re-read the real state.
  useEffect(() => {
    const stack = stackRef.current;
    setHovered(!!stack?.matches(':hover'));
    setFocused(!!stack?.contains(document.activeElement));
  }, [items.length]);

  const dismiss = useCallback((id: string) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((list) => list.filter((t) => !(t.id === id && t.leaving))), EXIT_MS);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    const tone = options.tone ?? 'info';
    const id = options.id ?? `${tone}:${options.title}:${options.description ?? ''}`;
    const next = { tone, title: options.title, description: options.description, duration: options.duration ?? DEFAULT_DURATION[tone] };
    setItems((list) => {
      const existing = list.find((t) => t.id === id);
      if (existing) return list.map((t) => (t.id === id ? { ...t, ...next, version: t.version + 1, leaving: false } : t));
      const kept = list.filter((t) => !t.leaving);
      return [...kept.slice(Math.max(0, kept.length - (MAX_VISIBLE - 1))), { id, ...next, version: 0, leaving: false }];
    });
    counter.current += 1;
    setAnnouncement({
      key: counter.current,
      text: options.description ? `${options.title}. ${options.description}` : options.title,
      urgent: tone === 'error' || tone === 'warning',
    });
    return id;
  }, []);

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  const paused = hovered || focused;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ConnectionNotices {...api} />
      {/* Always rendered so assistive technology is already watching when a message arrives. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement && !announcement.urgent && <p key={announcement.key}>{announcement.text}</p>}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {announcement?.urgent && <p key={announcement.key}>{announcement.text}</p>}
      </div>
      <section
        ref={stackRef}
        aria-label="Notifications"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocused(false)}
        className="fixed z-[1200] inset-x-0 bottom-0 sm:right-auto flex flex-col items-stretch sm:items-start gap-2 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 pointer-events-none"
      >
        {items.length > 0 && (
          <ol className="flex flex-col gap-2 w-full sm:w-auto">
            {items.map((item) => (
              <ToastCard key={item.id} item={item} paused={paused} onDismiss={dismiss} />
            ))}
          </ol>
        )}
      </section>
    </ToastContext.Provider>
  );
}
