'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { errorMessage } from '@/lib/http';
import { primaryButtonClass, secondaryButtonClass } from '@/components/dpwh/ui';

/**
 * Asks before a consequential action. Built on the native modal <dialog>,
 * so the page behind is inert, focus stays inside, and Escape cancels; the
 * dialog sits in the browser's top layer above the map, drawers and BP.
 *
 * Focus starts on Cancel (the safe choice) and returns to the control that
 * opened the dialog. If onConfirm returns a promise, both buttons lock and
 * the dialog stays open until it settles: it closes on success and shows
 * the failure inline otherwise, so nothing is reported done that was not.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** Say what happens ("Start sync", "Clear conversation"), never "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** "danger" for actions that discard or delete something. */
  tone?: 'default' | 'danger';
  onConfirm: () => void | Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setError(null);
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus();
    }
  }, [open]);

  const close = () => {
    if (!busy) onOpenChange(false);
  };

  const confirm = async () => {
    if (busy) return;
    setError(null);
    const result = onConfirm();
    if (!(result instanceof Promise)) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await result;
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, 'That did not work. Nothing was changed; please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Escape: let the dialog decide, and keep the key from also closing a panel behind it (BP, drawers).
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
      onClick={(e) => e.target === e.currentTarget && close()}
      className="m-auto w-[calc(100%-2rem)] max-w-md p-0 rounded-[22px] bg-raised text-ink border border-line shadow-float backdrop:bg-ink/35 backdrop:backdrop-blur-[2px] open:motion-safe:animate-[bp-in_200ms_var(--ease-out)]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          {tone === 'danger' && (
            <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-danger-soft" aria-hidden="true">
              <AlertTriangle className="w-5 h-5 text-danger-ink" />
            </span>
          )}
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            <div id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-subtle">{description}</div>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 p-3 rounded-xl border border-danger-line bg-danger-soft text-[13px] text-danger-ink">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={close} disabled={busy} className={secondaryButtonClass}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            aria-busy={busy}
            className={`${primaryButtonClass} disabled:opacity-60 disabled:cursor-not-allowed ${
              tone === 'danger' ? '!bg-danger-ink !text-surface hover:!opacity-90' : ''
            }`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
