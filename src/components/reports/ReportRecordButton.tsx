'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Flag, Loader2, LogIn } from 'lucide-react';
import { controlClass, primaryButtonClass, secondaryButtonClass, secondaryButtonSmClass } from '@/components/dpwh/ui';
import { submitRecordReport } from '@/lib/actions/reports';
import { errorMessage } from '@/lib/http';
import { validateRecordReport } from '@/lib/reports/validate';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { REPORT_CATEGORIES, REPORT_LIMITS, type ReportCategory } from '@/types/report';

type AuthState = 'checking' | 'signed-in' | 'signed-out' | 'unavailable';
type Field = 'category' | 'details' | 'observedOn' | 'locationNote';
interface FormError {
  field?: Field;
  message: string;
}

/**
 * "Report a concern" for one project in the directory. Place it inside a
 * project's details.
 *
 * Only people with an account can report. This component checks the browser's
 * session just to decide what to show (a form, or a prompt to sign in); that is
 * a convenience, not security. The Server Action requires a verified session
 * and the database refuses inserts from anyone else, so nothing here can be
 * used to report while signed out.
 */
export function ReportRecordButton({
  source,
  recordId,
  recordTitle,
}: {
  /** The directory's `source` id, e.g. dpwh_contracts or subaybayan_rlip. */
  source: string;
  recordId: string;
  /** Shown in the dialog so the reporter can confirm which project it is. */
  recordTitle: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const detailsRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const descId = useId();
  const fieldId = useId();

  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState<AuthState>('checking');
  const [category, setCategory] = useState<ReportCategory | ''>('');
  const [details, setDetails] = useState('');
  const [observedOn, setObservedOn] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [loginHref, setLoginHref] = useState('/login');

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      setAuth('unavailable');
      return;
    }
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (active) setAuth(data.session ? 'signed-in' : 'signed-out');
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? 'signed-in' : 'signed-out');
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

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

  const openDialog = () => {
    // Where to come back to after signing in. Read at click time so it includes the current filters/query.
    setLoginHref(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    setError(null);
    setOpen(true);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    // Start fresh next time, but keep what was typed if sending failed.
    if (doneId) {
      setDoneId(null);
      setCategory('');
      setDetails('');
      setObservedOn('');
      setLocationNote('');
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const input = { source, recordId, category, details, observedOn, locationNote };
    const check = validateRecordReport(input);
    if (!check.ok) {
      setError({ field: check.field, message: check.error });
      if (check.field === 'details') detailsRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      const result = await submitRecordReport(input);
      if (result.ok) {
        setDoneId(result.data.id);
      } else {
        setError({ message: result.error });
      }
    } catch (e) {
      setError({ message: errorMessage(e, 'Could not send your report. Please try again.') });
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (field: Field) => (error?.field === field ? error.message : null);
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the reporter's timezone

  return (
    <>
      <button type="button" onClick={openDialog} aria-haspopup="dialog" className={secondaryButtonSmClass}>
        <Flag className="w-3.5 h-3.5" aria-hidden="true" /> Report a concern
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
        {open && (
          <div className="p-5 sm:p-6">
            <h2 id={titleId} className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
              {doneId ? 'Report received' : auth === 'signed-in' ? 'Report a concern' : 'Sign in to report'}
            </h2>
            <p id={descId} className="mt-1.5 text-sm leading-relaxed text-subtle break-words">
              About: <span className="font-medium text-ink">{recordTitle}</span>
            </p>

            {auth === 'checking' && (
              <p className="mt-5 flex items-center gap-2 text-sm text-subtle" role="status">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Checking your sign-in…
              </p>
            )}

            {auth === 'unavailable' && (
              <p className="mt-5 text-sm text-subtle">
                Accounts are not set up in this environment yet, so reports cannot be sent.
              </p>
            )}

            {auth === 'signed-out' && (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-relaxed text-subtle">
                  Reports are tied to an account so LGU staff can follow up and so the system is not
                  flooded with anonymous submissions. Reading projects never needs an account.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link href={loginHref} className={primaryButtonClass}>
                    <LogIn className="w-4 h-4" aria-hidden="true" /> Sign in
                  </Link>
                  <Link href="/register" className={secondaryButtonClass}>Create an account</Link>
                </div>
              </div>
            )}

            {auth === 'signed-in' && doneId && (
              <div className="mt-5 space-y-4">
                <p className="flex items-start gap-2 text-sm leading-relaxed text-ink" role="status">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-ink" aria-hidden="true" />
                  <span>
                    Thank you. Your report is saved and private: only you and LGU staff can see it until staff
                    review it.{' '}
                    <span className="text-subtle">
                      Reference <span className="font-mono tabular-nums">{doneId.slice(0, 8).toUpperCase()}</span>
                    </span>
                  </span>
                </p>
                <div className="flex justify-end">
                  <button type="button" onClick={close} className={primaryButtonClass}>Close</button>
                </div>
              </div>
            )}

            {auth === 'signed-in' && !doneId && (
              <form onSubmit={submit} noValidate className="mt-5 space-y-5">
                <fieldset className="space-y-2" aria-describedby={fieldError('category') ? `${fieldId}-category-error` : undefined}>
                  <legend className="text-sm font-semibold text-ink">What is the concern?</legend>
                  {REPORT_CATEGORIES.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        category === option.value ? 'border-ink bg-sunken' : 'border-line hover:bg-sunken'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${fieldId}-category`}
                        value={option.value}
                        checked={category === option.value}
                        onChange={() => setCategory(option.value)}
                        className="mt-1 accent-ink"
                      />
                      <span className="text-sm">
                        <span className="block font-medium text-ink">{option.label}</span>
                        <span className="block text-xs text-subtle mt-0.5">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                  {fieldError('category') && (
                    <p id={`${fieldId}-category-error`} role="alert" className="text-[13px] text-danger-ink">{fieldError('category')}</p>
                  )}
                </fieldset>

                <div>
                  <label htmlFor={`${fieldId}-details`} className="block text-sm font-semibold text-ink">
                    What did you see?
                  </label>
                  <p id={`${fieldId}-details-hint`} className="mt-0.5 text-xs text-subtle">
                    Describe what you directly saw or know. Please leave out phone numbers, ID numbers and
                    accusations about named people.
                  </p>
                  <textarea
                    id={`${fieldId}-details`}
                    ref={detailsRef}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={5}
                    maxLength={REPORT_LIMITS.detailsMax}
                    aria-invalid={fieldError('details') ? true : undefined}
                    aria-describedby={`${fieldId}-details-hint${fieldError('details') ? ` ${fieldId}-details-error` : ''}`}
                    className="mt-2 w-full p-3 rounded-control text-sm border border-line-strong bg-surface text-ink placeholder:text-muted focus:outline-2 focus:outline-accent-ink"
                  />
                  <div className="mt-1 flex justify-between gap-3 text-xs text-subtle">
                    <span>
                      {fieldError('details') ? (
                        <span id={`${fieldId}-details-error`} role="alert" className="text-[13px] text-danger-ink">{fieldError('details')}</span>
                      ) : (
                        `At least ${REPORT_LIMITS.detailsMin} characters`
                      )}
                    </span>
                    <span className="tabular-nums">{details.length.toLocaleString('en-PH')} / {REPORT_LIMITS.detailsMax.toLocaleString('en-PH')}</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${fieldId}-date`} className="block text-sm font-semibold text-ink">
                      When did you see it? <span className="font-normal text-subtle">(optional)</span>
                    </label>
                    <input
                      id={`${fieldId}-date`}
                      type="date"
                      value={observedOn}
                      max={today}
                      onChange={(e) => setObservedOn(e.target.value)}
                      aria-invalid={fieldError('observedOn') ? true : undefined}
                      aria-describedby={fieldError('observedOn') ? `${fieldId}-date-error` : undefined}
                      className={`${controlClass} mt-2`}
                    />
                    {fieldError('observedOn') && (
                      <p id={`${fieldId}-date-error`} role="alert" className="mt-1 text-[13px] text-danger-ink">{fieldError('observedOn')}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor={`${fieldId}-where`} className="block text-sm font-semibold text-ink">
                      Where exactly? <span className="font-normal text-subtle">(optional)</span>
                    </label>
                    <input
                      id={`${fieldId}-where`}
                      type="text"
                      value={locationNote}
                      maxLength={REPORT_LIMITS.locationNoteMax}
                      onChange={(e) => setLocationNote(e.target.value)}
                      placeholder="Street, landmark, or purok"
                      className={`${controlClass} mt-2`}
                    />
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-subtle">
                  Your report is private. Only you and LGU staff can read it until staff review it. It is sent
                  with your account, and the project&apos;s details as they appear today are saved with it.
                </p>

                {error && !error.field && (
                  <p role="alert" className="flex items-start gap-2 p-3 rounded-xl border border-danger-line bg-danger-soft text-[13px] text-danger-ink">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" /> {error.message}
                  </p>
                )}

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                  <button type="button" onClick={close} disabled={busy} className={secondaryButtonClass}>Cancel</button>
                  <button type="submit" disabled={busy} aria-busy={busy} className={`${primaryButtonClass} disabled:opacity-60 disabled:cursor-not-allowed`}>
                    {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    Send report
                  </button>
                </div>
              </form>
            )}

            {(auth === 'checking' || auth === 'unavailable' || auth === 'signed-out') && (
              <div className="mt-5 flex justify-end">
                <button type="button" onClick={close} className={secondaryButtonClass}>Close</button>
              </div>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
