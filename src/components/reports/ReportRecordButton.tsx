'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { ReportPanel } from '@/components/reports/ReportPanel';
import { ShineLayers, shineOutlineClass, shineSolidClass, type ShineSize } from '@/components/ui/shine';
import type { ReportTarget } from '@/types/report';

/**
 * "Report a concern" for one project in the directory. Place it inside a
 * project's details. The form opens with this project's own code filled in.
 *
 * Who may report, and how that is enforced, is described on ReportPanel.
 */
export function ReportRecordButton({
  source,
  recordId,
  recordTitle,
  projectCode,
}: {
  /** The directory's `source` id, e.g. dpwh_contracts or subaybayan_rlip. */
  source: string;
  recordId: string;
  /** Shown in the dialog so the reporter can confirm which project it is. */
  recordTitle: string;
  /** The code the directory shows for this project; the record id when it has none. */
  projectCode?: string | null;
}) {
  const target = useMemo(
    () => ({ source, recordId, title: recordTitle, code: projectCode || recordId }),
    [source, recordId, recordTitle, projectCode]
  );
  // Orange, so it stands out among a project's other details.
  return <ReportDialogButton target={target} size="sm" solid />;
}

/**
 * "Report a concern" from a page that is not about one project (the landing
 * page). The form asks for the project code first.
 */
export function ReportConcernButton({ size = 'xl' }: { size?: 'sm' | 'lg' | 'xl' }) {
  return <ReportDialogButton target={null} size={size} />;
}

function ReportDialogButton({
  target,
  size,
  solid = false,
}: {
  /** The project the form is about, filled in and fixed; null asks for a project code. */
  target: ReportTarget | null;
  size: ShineSize;
  /** Orange at rest instead of an outline. */
  solid?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const state = useRef({ busy: false, done: false });
  const titleId = useId();
  const descId = useId();

  const [open, setOpen] = useState(false);
  // Changing the key starts the form fresh after a report was sent. Cancelling keeps what was typed.
  const [session, setSession] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus();
    }
  }, [open]);

  const close = () => {
    if (state.current.busy) return;
    setOpen(false);
    if (state.current.done) {
      state.current = { busy: false, done: false };
      setSession((n) => n + 1);
    }
  };

  const onState = useCallback((next: { busy: boolean; done: boolean }) => {
    state.current = next;
  }, []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={solid ? shineSolidClass(size) : shineOutlineClass(size)}>
        <ShineLayers solid={solid} />
        <span className="relative z-10 inline-flex items-center gap-1.5">
          <Flag className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} transition-transform duration-300 ease-out group-hover:-rotate-12 motion-reduce:transition-none`} aria-hidden="true" /> Report a concern
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descId}
        // Escape closes this dialog only, not the drawer or panel behind it.
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 rounded-[22px] bg-raised text-ink border border-line shadow-float backdrop:bg-ink/35 backdrop:backdrop-blur-[2px]"
      >
        <ReportPanel
          key={session}
          target={target}
          locked={Boolean(target)}
          active={open}
          titleId={titleId}
          descId={descId}
          onClose={close}
          onState={onState}
        />
      </dialog>
    </>
  );
}
